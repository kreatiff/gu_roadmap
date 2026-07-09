import { v4 as uuidv4 } from 'uuid';
import { requireAdmin } from '../auth.js';
import { featuresContainer, featureNotesContainer } from '../db.js';
import { NOTE_MAX_LENGTH } from '../constants.js';

export default async function featureNotesRoutes(fastify, options) {

  async function ensureFeatureExists(id, reply) {
    try {
      await featuresContainer.item(id, id).read();
      return true;
    } catch (err) {
      if (err.code === 404) {
        reply.code(404).send({ error: 'Feature not found' });
        return false;
      }
      throw err;
    }
  }

  // ── GET /:id/notes — Admin: list note entries, newest first ───────────────
  fastify.get('/:id/notes', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id } = request.params;
    if (!(await ensureFeatureExists(id, reply))) return;

    const { resources } = await featureNotesContainer.items
      .query(
        {
          query: 'SELECT * FROM c WHERE c.featureId = @fid ORDER BY c.createdAt DESC',
          parameters: [{ name: '@fid', value: id }],
        },
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();
    return resources;
  });

  // ── POST /:id/notes — Admin: create a note entry ───────────────────────────
  fastify.post('/:id/notes', {
    preHandler: [requireAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 1, maxLength: NOTE_MAX_LENGTH },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    if (!(await ensureFeatureExists(id, reply))) return;

    const doc = {
      id: uuidv4(),
      featureId: id,
      content: request.body.content,
      authorId: request.user.sub,
      authorName: request.user.name,
      authorEmail: request.user.email,
      createdAt: new Date().toISOString(),
      updatedAt: null,
      edited: false,
    };
    const { resource } = await featureNotesContainer.items.create(doc);
    return reply.code(201).send(resource);
  });

  // ── PATCH /:id/notes/:noteId — Admin: edit your own note entry ─────────────
  fastify.patch('/:id/notes/:noteId', {
    preHandler: [requireAdmin],
    schema: {
      body: {
        type: 'object',
        required: ['content'],
        properties: {
          content: { type: 'string', minLength: 1, maxLength: NOTE_MAX_LENGTH },
        },
      },
    },
  }, async (request, reply) => {
    const { id, noteId } = request.params;

    let note;
    try {
      const { resource } = await featureNotesContainer.item(noteId, id).read();
      note = resource;
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Note not found' });
      throw err;
    }

    if (note.authorId !== request.user.sub) {
      return reply.code(403).send({ error: 'You can only edit your own notes' });
    }

    const updated = {
      ...note,
      content: request.body.content,
      edited: true,
      updatedAt: new Date().toISOString(),
    };
    const { resource } = await featureNotesContainer.item(noteId, id).replace(updated);
    return resource;
  });

  // ── DELETE /:id/notes/:noteId — Admin: delete your own note entry ──────────
  fastify.delete('/:id/notes/:noteId', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id, noteId } = request.params;

    let note;
    try {
      const { resource } = await featureNotesContainer.item(noteId, id).read();
      note = resource;
    } catch (err) {
      if (err.code === 404) return reply.code(404).send({ error: 'Note not found' });
      throw err;
    }

    if (note.authorId !== request.user.sub) {
      return reply.code(403).send({ error: 'You can only delete your own notes' });
    }

    await featureNotesContainer.item(noteId, id).delete();
    return { ok: true };
  });
}
