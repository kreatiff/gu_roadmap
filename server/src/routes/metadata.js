import { featuresContainer } from '../db.js';
import { requireAdmin } from '../auth.js';

export default async function metadataRoutes(fastify, options) {
  // ── 1. GET /:type — List all metadata values with usage counts ──────────────
  fastify.get('/:type', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { type } = request.params;
    if (!['tags', 'owners', 'stakeholders'].includes(type)) {
      return reply.code(400).send({ error: 'Invalid metadata type. Must be tags, owners, or stakeholders.' });
    }

    let query;
    if (type === 'tags') {
      query = 'SELECT c.tags FROM c';
    } else if (type === 'owners') {
      query = 'SELECT c.owner FROM c';
    } else {
      query = 'SELECT c.key_stakeholder FROM c';
    }

    const { resources } = await featuresContainer.items
      .query(query, { enableCrossPartitionQuery: true })
      .fetchAll();

    const counts = {};

    if (type === 'tags') {
      resources.forEach(r => {
        (r.tags || []).forEach(tag => {
          counts[tag] = (counts[tag] || 0) + 1;
        });
      });
    } else {
      resources.forEach(r => {
        const val = type === 'owners' ? r.owner : r.key_stakeholder;
        if (val) {
          counts[val] = (counts[val] || 0) + 1;
        }
      });
    }

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
    if (!oldValue || !newValue) {
      return reply.code(400).send({ error: 'oldValue and newValue are required' });
    }
    if (oldValue === newValue) {
      return reply.code(400).send({ error: 'oldValue and newValue must be different' });
    }

    let resources = [];
    let updatedCount = 0;

    if (type === 'tags') {
      const queryResult = await featuresContainer.items.query({
        query: 'SELECT * FROM c WHERE ARRAY_CONTAINS(c.tags, @oldValue)',
        parameters: [{ name: '@oldValue', value: oldValue }]
      }, { enableCrossPartitionQuery: true }).fetchAll();
      resources = queryResult.resources;

      await Promise.all(resources.map(feature => {
        const newTags = feature.tags.map(t => t === oldValue ? newValue : t);
        return featuresContainer.item(feature.id, feature.id).replace({
          ...feature,
          tags: newTags
        });
      }));
      updatedCount = resources.length;
    } else if (type === 'owners') {
      const queryResult = await featuresContainer.items.query({
        query: 'SELECT * FROM c WHERE c.owner = @oldValue',
        parameters: [{ name: '@oldValue', value: oldValue }]
      }, { enableCrossPartitionQuery: true }).fetchAll();
      resources = queryResult.resources;

      await Promise.all(resources.map(feature =>
        featuresContainer.item(feature.id, feature.id).patch([
          { op: 'set', path: '/owner', value: newValue }
        ])
      ));
      updatedCount = resources.length;
    } else {
      const queryResult = await featuresContainer.items.query({
        query: 'SELECT * FROM c WHERE c.key_stakeholder = @oldValue',
        parameters: [{ name: '@oldValue', value: oldValue }]
      }, { enableCrossPartitionQuery: true }).fetchAll();
      resources = queryResult.resources;

      await Promise.all(resources.map(feature =>
        featuresContainer.item(feature.id, feature.id).patch([
          { op: 'set', path: '/key_stakeholder', value: newValue }
        ])
      ));
      updatedCount = resources.length;
    }

    return { success: true, updatedCount };
  });

  // ── 3. DELETE /:type — Delete a value from all features ──────────────────────
  fastify.delete('/:type', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { type } = request.params;
    const { value } = request.body;

    if (!['tags', 'owners', 'stakeholders'].includes(type)) {
      return reply.code(400).send({ error: 'Invalid metadata type' });
    }
    if (!value) {
      return reply.code(400).send({ error: 'value is required' });
    }

    let resources = [];
    let updatedCount = 0;

    if (type === 'tags') {
      const queryResult = await featuresContainer.items.query({
        query: 'SELECT * FROM c WHERE ARRAY_CONTAINS(c.tags, @value)',
        parameters: [{ name: '@value', value: value }]
      }, { enableCrossPartitionQuery: true }).fetchAll();
      resources = queryResult.resources;

      await Promise.all(resources.map(feature => {
        const newTags = feature.tags.filter(t => t !== value);
        return featuresContainer.item(feature.id, feature.id).replace({
          ...feature,
          tags: newTags
        });
      }));
      updatedCount = resources.length;
    } else if (type === 'owners') {
      const queryResult = await featuresContainer.items.query({
        query: 'SELECT * FROM c WHERE c.owner = @value',
        parameters: [{ name: '@value', value: value }]
      }, { enableCrossPartitionQuery: true }).fetchAll();
      resources = queryResult.resources;

      await Promise.all(resources.map(feature =>
        featuresContainer.item(feature.id, feature.id).patch([
          { op: 'set', path: '/owner', value: '' }
        ])
      ));
      updatedCount = resources.length;
    } else {
      const queryResult = await featuresContainer.items.query({
        query: 'SELECT * FROM c WHERE c.key_stakeholder = @value',
        parameters: [{ name: '@value', value: value }]
      }, { enableCrossPartitionQuery: true }).fetchAll();
      resources = queryResult.resources;

      await Promise.all(resources.map(feature =>
        featuresContainer.item(feature.id, feature.id).patch([
          { op: 'set', path: '/key_stakeholder', value: '' }
        ])
      ));
      updatedCount = resources.length;
    }

    return { success: true, updatedCount };
  });
}
