import { featuresContainer, metadataConfigsContainer, usersContainer } from '../db.js';
import { requireAdmin } from '../auth.js';

const META_CONFIG = {
  tags: { field: 'tags', isArray: true },
  owners: { field: 'owner', isArray: false },
  stakeholders: { field: 'key_stakeholder', isArray: false },
};

function isValidType(type) {
  return ['tags', 'owners', 'stakeholders'].includes(type);
}

function buildMetadataQuery(type, value) {
  if (type === 'tags') {
    return {
      query: 'SELECT * FROM c WHERE ARRAY_CONTAINS(c.tags, @value)',
      parameters: [{ name: '@value', value }]
    };
  }
  const field = META_CONFIG[type].field;
  return {
    query: `SELECT * FROM c WHERE c.${field} = @value`,
    parameters: [{ name: '@value', value }]
  };
}

function buildPatchOps(type, feature, oldValue, newValue) {
  // newValue === undefined means delete operation
  if (type === 'tags') {
    if (newValue !== undefined) {
      const newTags = [...new Set(feature.tags.map(t => t === oldValue ? newValue : t))];
      return [{ op: 'set', path: '/tags', value: newTags }];
    }
    const newTags = feature.tags.filter(t => t !== oldValue);
    return [{ op: 'set', path: '/tags', value: newTags }];
  }
  const field = META_CONFIG[type].field;
  const value = newValue !== undefined ? newValue : '';
  return [{ op: 'set', path: `/${field}`, value }];
}

function buildResponse(reply, updatedCount, failures) {
  if (failures.length > 0 && updatedCount === 0) {
    return reply.code(500).send({ error: 'All updates failed', failures });
  }
  if (failures.length > 0 && updatedCount > 0) {
    return reply.code(207).send({ success: true, updatedCount, failures, warning: 'Some updates failed' });
  }
  return { success: true, updatedCount };
}

export default async function metadataRoutes(fastify, options) {
  // ── GET /users/emails — Fetch active user emails for autocomplete ────────────
  fastify.get('/users/emails', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { resources } = await usersContainer.items
        .query({
          query: "SELECT DISTINCT VALUE c.email FROM c WHERE c.status = 'active'"
        }, { enableCrossPartitionQuery: true })
        .fetchAll();
      return resources.filter(Boolean);
    } catch (err) {
      request.log.error(err, 'Failed to fetch active user emails');
      return reply.code(500).send({ error: 'Failed to fetch user emails' });
    }
  });

  // ── GET /configs — Get all metadata configurations (mappings) ───────────────
  fastify.get('/configs', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      const { resources } = await metadataConfigsContainer.items
        .query({
          query: 'SELECT * FROM c WHERE c.type = @type',
          parameters: [{ name: '@type', value: 'owner' }]
        }, { enableCrossPartitionQuery: true })
        .fetchAll();
      return resources;
    } catch (err) {
      request.log.error(err, 'Failed to fetch metadata configs');
      return reply.code(500).send({ error: 'Failed to fetch configurations' });
    }
  });

  // ── POST /configs — Upsert a metadata configuration mapping ─────────────────
  fastify.post('/configs', {
    preHandler: [requireAdmin],
    schema: {
      body: {
        type: 'object',
        properties: {
          value: { type: 'string' },
          jira_reporter_email: { type: 'string' }
        },
        required: ['value']
      }
    }
  }, async (request, reply) => {
    const { value, jira_reporter_email } = request.body;
    const trimmedVal = value.trim();
    const trimmedEmail = jira_reporter_email?.trim() || '';
    const id = `owner:${trimmedVal}`;

    try {
      const doc = {
        id,
        type: 'owner',
        value: trimmedVal,
        jira_reporter_email: trimmedEmail,
        updated_at: new Date().toISOString()
      };

      await metadataConfigsContainer.items.upsert(doc);
      return { success: true, doc };
    } catch (err) {
      request.log.error(err, 'Failed to save metadata config');
      return reply.code(500).send({ error: 'Failed to save configuration' });
    }
  });

  // ── 1. GET /:type — List all metadata values with usage counts ──────────────
  fastify.get('/:type', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { type } = request.params;
    if (!isValidType(type)) {
      return reply.code(400).send({ error: 'Invalid metadata type. Must be tags, owners, or stakeholders.' });
    }

    const config = META_CONFIG[type];
    const query = `SELECT c.${config.field} FROM c`;

    const { resources } = await featuresContainer.items
      .query({ query }, { enableCrossPartitionQuery: true })
      .fetchAll();

    const counts = {};

    resources.forEach(r => {
      if (config.isArray) {
        (r[config.field] || []).forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      } else {
        const val = r[config.field];
        if (val) {
          counts[val] = (counts[val] || 0) + 1;
        }
      }
    });

    const result = Object.entries(counts)
      .map(([value, usageCount]) => ({ value, usageCount }))
      .sort((a, b) => a.value.localeCompare(b.value));

    return result;
  });

  // ── 2. PUT /:type/rename — Rename a value across all features ───────────────
  fastify.put('/:type/rename', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { type } = request.params;
    const { oldValue, newValue } = request.body;

    if (!isValidType(type)) {
      return reply.code(400).send({ error: 'Invalid metadata type' });
    }

    const trimmedOld = oldValue?.trim();
    const trimmedNew = newValue?.trim();
    if (!trimmedOld || !trimmedNew) {
      return reply.code(400).send({ error: 'oldValue and newValue are required' });
    }
    if (trimmedOld === trimmedNew) {
      return reply.code(400).send({ error: 'oldValue and newValue must be different' });
    }

    const querySpec = buildMetadataQuery(type, trimmedOld);
    const { resources } = await featuresContainer.items.query(querySpec, { enableCrossPartitionQuery: true }).fetchAll();

    const results = await Promise.allSettled(resources.map(feature => {
      const ops = buildPatchOps(type, feature, trimmedOld, trimmedNew);
      return featuresContainer.item(feature.id, feature.id).patch(ops);
    }));

    const updatedCount = results.filter(r => r.status === 'fulfilled').length;
    const failures = results
      .map((r, i) => ({ status: r.status, id: resources[i].id, reason: r.reason?.message }))
      .filter(r => r.status === 'rejected');

    if (type === 'owners' && updatedCount > 0) {
      const oldId = `owner:${trimmedOld}`;
      const newId = `owner:${trimmedNew}`;
      try {
        const { resource: existing } = await metadataConfigsContainer.item(oldId, oldId).read();
        if (existing) {
          await metadataConfigsContainer.item(oldId, oldId).delete();
          const newDoc = {
            ...existing,
            id: newId,
            value: trimmedNew,
            updated_at: new Date().toISOString()
          };
          await metadataConfigsContainer.items.create(newDoc);
        }
      } catch (e) {
        if (e.statusCode !== 404 && e.code !== 404) {
          request.log.error(e, 'Failed to update metadata config during rename');
        }
      }
    }

    return buildResponse(reply, updatedCount, failures);
  });

  // ── 3. DELETE /:type — Delete a value from all features ──────────────────────
  fastify.delete('/:type', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { type } = request.params;
    const { value } = request.body;

    if (!isValidType(type)) {
      return reply.code(400).send({ error: 'Invalid metadata type' });
    }

    const trimmedValue = value?.trim();
    if (!trimmedValue) {
      return reply.code(400).send({ error: 'value is required' });
    }

    const querySpec = buildMetadataQuery(type, trimmedValue);
    const { resources } = await featuresContainer.items.query(querySpec, { enableCrossPartitionQuery: true }).fetchAll();

    const results = await Promise.allSettled(resources.map(feature => {
      const ops = buildPatchOps(type, feature, trimmedValue, undefined);
      return featuresContainer.item(feature.id, feature.id).patch(ops);
    }));

    const updatedCount = results.filter(r => r.status === 'fulfilled').length;
    const failures = results
      .map((r, i) => ({ status: r.status, id: resources[i].id, reason: r.reason?.message }))
      .filter(r => r.status === 'rejected');

    if (type === 'owners' && updatedCount > 0) {
      const configId = `owner:${trimmedValue}`;
      try {
        await metadataConfigsContainer.item(configId, configId).delete();
      } catch (e) {
        if (e.statusCode !== 404 && e.code !== 404) {
          request.log.error(e, 'Failed to delete metadata config during delete');
        }
      }
    }

    return buildResponse(reply, updatedCount, failures);
  });
}
