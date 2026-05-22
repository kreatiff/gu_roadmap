import { dashboardsContainer, featuresContainer, stagesContainer } from '../db.js';
import { requireAdmin } from '../auth.js';
import { v4 as uuidv4 } from 'uuid';
import slugify from 'slugify';
import bcrypt from 'bcryptjs';
import { BCRYPT_ROUNDS } from '../constants.js';

// Pre-compute dummy hash for timing-safe dashboard verification
const DUMMY_HASH = bcrypt.hashSync('__dummy__', BCRYPT_ROUNDS);

export default async function dashboardRoutes(fastify, options) {

  // ── Helper: fetch by slug ─────────────────────────────────────────────────
  async function findBySlug(slug) {
    const { resources } = await dashboardsContainer.items
      .query(
        { query: 'SELECT * FROM c WHERE c.slug = @slug',
          parameters: [{ name: '@slug', value: slug }] },
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();
    return resources[0] ?? null;
  }

  // ── Helper: validate available_views ──────────────────────────────────────
  const ALLOWED_VIEWS = ['grid', 'swimlane', 'table'];
  function normalizeAvailableViews(raw) {
    if (!Array.isArray(raw)) return ['grid'];
    const filtered = raw.filter(v => ALLOWED_VIEWS.includes(v));
    return filtered.length > 0 ? filtered : ['grid'];
  }

  // ── Helper: verify dashboard unlock token ─────────────────────────────────
  async function verifyDashboardToken(request, reply, doc) {
    if (!doc.is_protected) return true;

    const token = request.headers['x-dashboard-token'];
    if (!token) {
      reply.code(403).send({ error: 'Dashboard is password protected' });
      return false;
    }

    try {
      const decoded = await fastify.jwt.verify(token);
      if (decoded.purpose !== 'dashboard-unlock' || decoded.dashboardSlug !== doc.slug) {
        throw new Error('Invalid token');
      }
      return true;
    } catch {
      reply.code(403).send({ error: 'Invalid or expired dashboard token' });
      return false;
    }
  }

  // ── GET / — Public: list all dashboards (no password_hash) ────────────────
  fastify.get('/', async (request, reply) => {
    const { resources } = await dashboardsContainer.items
      .query('SELECT c.id, c.name, c.slug, c.filters, c.is_protected, c.available_views, c.created_by, c.created_at FROM c ORDER BY c.created_at DESC',
             { enableCrossPartitionQuery: true })
      .fetchAll();
    return resources;
  });

  // ── GET /:slug — Public: resolve dashboard config (no password_hash) ──────
  // This endpoint is intentionally open — it only returns metadata so the
  // client can determine whether to show a password gate or the dashboard.
  fastify.get('/:slug', async (request, reply) => {
    const doc = await findBySlug(request.params.slug);
    if (!doc) return reply.code(404).send({ error: 'Dashboard not found' });

    // Strip hash before returning
    const { password_hash, ...safe } = doc;
    return safe;
  });

  // ── POST /:slug/unlock — Validate password, return session token ───────────
  // Returns { ok: true, token } on success; client stores token in sessionStorage.
  fastify.post('/:slug/unlock', async (request, reply) => {
    const doc = await findBySlug(request.params.slug);

    const { password } = request.body ?? {};
    if (!password) return reply.code(400).send({ error: 'password required' });

    // Always perform bcrypt.compare to prevent timing attacks that reveal
    // whether a dashboard exists or is password-protected.
    const candidateHash = doc?.password_hash ?? DUMMY_HASH;
    const match = await bcrypt.compare(password, candidateHash);

    if (!doc) return reply.code(404).send({ error: 'Dashboard not found' });
    if (!doc.is_protected) return { ok: true }; // unprotected — always ok
    if (!match) return reply.code(403).send({ error: 'Incorrect password' });

    // Issue a short-lived signed token the client stores in sessionStorage
    const token = await reply.jwtSign(
      { dashboardSlug: doc.slug, purpose: 'dashboard-unlock' },
      { expiresIn: '8h' }
    );
    return { ok: true, token };
  });

  // ── GET /:slug/meta — Public: scoped stages for this dashboard ───────────────
  // Returns only the stages that actually have features within this dashboard's
  // filter scope, so the client can populate status pills accurately.
  fastify.get('/:slug/meta', async (request, reply) => {
    const doc = await findBySlug(request.params.slug);
    if (!doc) return reply.code(404).send({ error: 'Dashboard not found' });

    const allowed = await verifyDashboardToken(request, reply, doc);
    if (!allowed) return;

    const { filters } = doc;

    // Build the same WHERE conditions as the features list endpoint
    const conditions = ['c.is_published = true'];
    const parameters = [];

    if (filters.tags?.length > 0) {
      const tagConditions = [];
      filters.tags.forEach((tag, i) => {
        tagConditions.push(`ARRAY_CONTAINS(c.tags, @tag${i})`);
        parameters.push({ name: `@tag${i}`, value: tag });
      });
      conditions.push(`(${tagConditions.join(' OR ')})`);
    }

    const categoryIds = filters.category_ids || (filters.category_id ? [filters.category_id] : []);
    if (categoryIds.length > 0) {
      const categoryConditions = [];
      categoryIds.forEach((c, i) => {
        categoryConditions.push(`c.category_id = @category${i}`);
        parameters.push({ name: `@category${i}`, value: c });
      });
      conditions.push(`(${categoryConditions.join(' OR ')})`);
    }

    const stageSlugs = filters.stage_slugs || (filters.stage_slug ? [filters.stage_slug] : []);
    if (stageSlugs.length > 0) {
      const stageConditions = [];
      stageSlugs.forEach((s, i) => {
        stageConditions.push(`c.status = @stage${i} OR c.stage_slug = @stage${i}`);
        parameters.push({ name: `@stage${i}`, value: s });
      });
      conditions.push(`(${stageConditions.join(' OR ')})`);
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`;

    // Fetch distinct stage_slugs and all tags from matching features
    const { resources: featureRows } = await featuresContainer.items
      .query(
        {
          query: `SELECT c.stage_slug, c.tags FROM c ${whereClause}`,
          parameters,
        },
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();

    const presentSlugs = new Set(featureRows.map(f => f.stage_slug).filter(Boolean));
    const presentTags = [...new Set(featureRows.flatMap(f => f.tags ?? []))].sort();

    // Fetch full stage objects for matched slugs
    const { resources: allStages } = await stagesContainer.items
      .query('SELECT * FROM c ORDER BY c.order_idx ASC', { enableCrossPartitionQuery: true })
      .fetchAll();

    const scopedStages = allStages.filter(s => presentSlugs.has(s.slug));

    return { 
      stages: scopedStages,
      tags: presentTags
    };
  });

  // ── POST / — Admin: create dashboard ─────────────────────────────────────
  fastify.post('/', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { name, filters = {}, password, available_views } = request.body;
    if (!name) return reply.code(400).send({ error: 'name is required' });

    const id   = uuidv4();
    const slug = slugify(name, { lower: true, strict: true });
    const now  = new Date().toISOString();

    const is_protected = typeof password === 'string' && password.length > 0;
    const password_hash = is_protected
      ? await bcrypt.hash(password, BCRYPT_ROUNDS)
      : null;

    const doc = {
      id,
      name,
      slug,
      filters: {
        tags: Array.isArray(filters.tags) ? filters.tags : [],
        category_ids: Array.isArray(filters.category_ids) ? filters.category_ids : (filters.category_id ? [filters.category_id] : []),
        stage_slugs: Array.isArray(filters.stage_slugs) ? filters.stage_slugs : (filters.stage_slug ? [filters.stage_slug] : []),
      },
      is_protected,
      password_hash,
      available_views: normalizeAvailableViews(available_views),
      created_by: request.user?.email ?? 'System',
      created_at: now,
    };

    try {
      await dashboardsContainer.items.create(doc);
    } catch (err) {
      if (err.code === 409)
        return reply.code(409).send({ error: 'A dashboard with this slug already exists' });
      throw err;
    }

    return reply.code(201).send({ id, slug, is_protected, available_views: doc.available_views });
  });

  // ── PUT /:id — Admin: update dashboard ───────────────────────────────────
  fastify.put('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    const { name, filters, password, available_views } = request.body;

    let existing;
    try {
      const { resource } = await dashboardsContainer.item(id, id).read();
      existing = resource;
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Dashboard not found' });
      throw err;
    }

    const updated = { ...existing };

    if (name !== undefined) {
      updated.name = name;
      updated.slug = slugify(name, { lower: true, strict: true });
    }

    if (filters !== undefined) {
      updated.filters = {
        tags: Array.isArray(filters.tags) ? filters.tags : (existing.filters?.tags ?? []),
        category_ids: filters.category_ids !== undefined
          ? (Array.isArray(filters.category_ids) ? filters.category_ids : (filters.category_ids ? [filters.category_ids] : []))
          : (existing.filters?.category_ids ?? []),
        stage_slugs: filters.stage_slugs !== undefined
          ? (Array.isArray(filters.stage_slugs) ? filters.stage_slugs : (filters.stage_slugs ? [filters.stage_slugs] : []))
          : (existing.filters?.stage_slugs ?? []),
      };
    }

    if (password !== undefined) {
      const hasPassword = typeof password === 'string' && password.length > 0;
      if (hasPassword) {
        updated.is_protected = true;
        updated.password_hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      } else {
        updated.is_protected = false;
        updated.password_hash = null;
      }
    }

    if (available_views !== undefined) {
      updated.available_views = normalizeAvailableViews(available_views);
    }

    updated.updated_at = new Date().toISOString();

    try {
      await dashboardsContainer.item(id, id).replace(updated);
    } catch (err) {
      if (err.code === 409)
        return reply.code(409).send({ error: 'A dashboard with this slug already exists' });
      throw err;
    }

    const { password_hash, ...safe } = updated;
    return safe;
  });

  // ── DELETE /:id — Admin: delete dashboard ────────────────────────────────
  fastify.delete('/:id', { preHandler: [requireAdmin] }, async (request, reply) => {
    try {
      await dashboardsContainer.item(request.params.id, request.params.id).delete();
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Dashboard not found' });
      throw err;
    }
    return { ok: true };
  });
}
