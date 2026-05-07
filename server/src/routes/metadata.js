import { featuresContainer } from '../db.js';
import { requireAdmin } from '../auth.js';

const META_CONFIG = {
  tags: { field: 'tags', isArray: true },
  owners: { field: 'owner', isArray: false },
  stakeholders: { field: 'key_stakeholder', isArray: false },
};

export default async function metadataRoutes(fastify, options) {
  // ── 1. GET /:type — List all metadata values with usage counts ──────────────
  fastify.get('/:type', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { type } = request.params;
    if (!['tags', 'owners', 'stakeholders'].includes(type)) {
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

    if (!['tags', 'owners', 'stakeholders'].includes(type)) {
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

    let resources = [];

    if (type === 'tags') {
      const queryResult = await featuresContainer.items.query({
        query: 'SELECT * FROM c WHERE ARRAY_CONTAINS(c.tags, @oldValue)',
        parameters: [{ name: '@oldValue', value: trimmedOld }]
      }, { enableCrossPartitionQuery: true }).fetchAll();
      resources = queryResult.resources;

      const results = await Promise.allSettled(resources.map(feature => {
        const newTags = [...new Set(feature.tags.map(t => t === trimmedOld ? trimmedNew : t))];
        return featuresContainer.item(feature.id, feature.id).patch([
          { op: 'set', path: '/tags', value: newTags }
        ]);
      }));
      const updatedCount = results.filter(r => r.status === 'fulfilled').length;
      const failures = results
        .map((r, i) => ({ status: r.status, id: resources[i].id, reason: r.reason?.message }))
        .filter(r => r.status === 'rejected');
      if (failures.length > 0 && updatedCount === 0) {
        return reply.code(500).send({ error: 'All updates failed', failures });
      }
      if (failures.length > 0 && updatedCount > 0) {
        return reply.code(207).send({ success: true, updatedCount, failures, warning: 'Some updates failed' });
      }
      return { success: true, updatedCount };
    } else if (type === 'owners') {
      const queryResult = await featuresContainer.items.query({
        query: 'SELECT * FROM c WHERE c.owner = @oldValue',
        parameters: [{ name: '@oldValue', value: trimmedOld }]
      }, { enableCrossPartitionQuery: true }).fetchAll();
      resources = queryResult.resources;

      const results = await Promise.allSettled(resources.map(feature =>
        featuresContainer.item(feature.id, feature.id).patch([
          { op: 'set', path: '/owner', value: trimmedNew }
        ])
      ));
      const updatedCount = results.filter(r => r.status === 'fulfilled').length;
      const failures = results
        .map((r, i) => ({ status: r.status, id: resources[i].id, reason: r.reason?.message }))
        .filter(r => r.status === 'rejected');
      if (failures.length > 0 && updatedCount === 0) {
        return reply.code(500).send({ error: 'All updates failed', failures });
      }
      if (failures.length > 0 && updatedCount > 0) {
        return reply.code(207).send({ success: true, updatedCount, failures, warning: 'Some updates failed' });
      }
      return { success: true, updatedCount };
    } else {
      const queryResult = await featuresContainer.items.query({
        query: 'SELECT * FROM c WHERE c.key_stakeholder = @oldValue',
        parameters: [{ name: '@oldValue', value: trimmedOld }]
      }, { enableCrossPartitionQuery: true }).fetchAll();
      resources = queryResult.resources;

      const results = await Promise.allSettled(resources.map(feature =>
        featuresContainer.item(feature.id, feature.id).patch([
          { op: 'set', path: '/key_stakeholder', value: trimmedNew }
        ])
      ));
      const updatedCount = results.filter(r => r.status === 'fulfilled').length;
      const failures = results
        .map((r, i) => ({ status: r.status, id: resources[i].id, reason: r.reason?.message }))
        .filter(r => r.status === 'rejected');
      if (failures.length > 0 && updatedCount === 0) {
        return reply.code(500).send({ error: 'All updates failed', failures });
      }
      if (failures.length > 0 && updatedCount > 0) {
        return reply.code(207).send({ success: true, updatedCount, failures, warning: 'Some updates failed' });
      }
      return { success: true, updatedCount };
    }
  });

  // ── 3. DELETE /:type — Delete a value from all features ──────────────────────
  fastify.delete('/:type', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { type } = request.params;
    const { value } = request.body;

    if (!['tags', 'owners', 'stakeholders'].includes(type)) {
      return reply.code(400).send({ error: 'Invalid metadata type' });
    }

    const trimmedValue = value?.trim();
    if (!trimmedValue) {
      return reply.code(400).send({ error: 'value is required' });
    }

    let resources = [];

    if (type === 'tags') {
      const queryResult = await featuresContainer.items.query({
        query: 'SELECT * FROM c WHERE ARRAY_CONTAINS(c.tags, @value)',
        parameters: [{ name: '@value', value: trimmedValue }]
      }, { enableCrossPartitionQuery: true }).fetchAll();
      resources = queryResult.resources;

      const results = await Promise.allSettled(resources.map(feature => {
        const newTags = feature.tags.filter(t => t !== trimmedValue);
        return featuresContainer.item(feature.id, feature.id).patch([
          { op: 'set', path: '/tags', value: newTags }
        ]);
      }));
      const updatedCount = results.filter(r => r.status === 'fulfilled').length;
      const failures = results
        .map((r, i) => ({ status: r.status, id: resources[i].id, reason: r.reason?.message }))
        .filter(r => r.status === 'rejected');
      if (failures.length > 0 && updatedCount === 0) {
        return reply.code(500).send({ error: 'All updates failed', failures });
      }
      if (failures.length > 0 && updatedCount > 0) {
        return reply.code(207).send({ success: true, updatedCount, failures, warning: 'Some updates failed' });
      }
      return { success: true, updatedCount };
    } else if (type === 'owners') {
      const queryResult = await featuresContainer.items.query({
        query: 'SELECT * FROM c WHERE c.owner = @value',
        parameters: [{ name: '@value', value: trimmedValue }]
      }, { enableCrossPartitionQuery: true }).fetchAll();
      resources = queryResult.resources;

      const results = await Promise.allSettled(resources.map(feature =>
        featuresContainer.item(feature.id, feature.id).patch([
          { op: 'set', path: '/owner', value: '' }
        ])
      ));
      const updatedCount = results.filter(r => r.status === 'fulfilled').length;
      const failures = results
        .map((r, i) => ({ status: r.status, id: resources[i].id, reason: r.reason?.message }))
        .filter(r => r.status === 'rejected');
      if (failures.length > 0 && updatedCount === 0) {
        return reply.code(500).send({ error: 'All updates failed', failures });
      }
      if (failures.length > 0 && updatedCount > 0) {
        return reply.code(207).send({ success: true, updatedCount, failures, warning: 'Some updates failed' });
      }
      return { success: true, updatedCount };
    } else {
      const queryResult = await featuresContainer.items.query({
        query: 'SELECT * FROM c WHERE c.key_stakeholder = @value',
        parameters: [{ name: '@value', value: trimmedValue }]
      }, { enableCrossPartitionQuery: true }).fetchAll();
      resources = queryResult.resources;

      const results = await Promise.allSettled(resources.map(feature =>
        featuresContainer.item(feature.id, feature.id).patch([
          { op: 'set', path: '/key_stakeholder', value: '' }
        ])
      ));
      const updatedCount = results.filter(r => r.status === 'fulfilled').length;
      const failures = results
        .map((r, i) => ({ status: r.status, id: resources[i].id, reason: r.reason?.message }))
        .filter(r => r.status === 'rejected');
      if (failures.length > 0 && updatedCount === 0) {
        return reply.code(500).send({ error: 'All updates failed', failures });
      }
      if (failures.length > 0 && updatedCount > 0) {
        return reply.code(207).send({ success: true, updatedCount, failures, warning: 'Some updates failed' });
      }
      return { success: true, updatedCount };
    }
  });
}
