import { v4 as uuidv4 } from 'uuid';
import { requireAdmin, requireSuperAdmin } from '../auth.js';
import { config } from '../config.js';
import { featuresContainer, featureNotesContainer, revisionsContainer } from '../db.js';
import { NOTE_MAX_LENGTH } from '../constants.js';
import { callAzureOpenAI } from '../lib/azureOpenAI.js';
import {
  tiptapToPlainText,
  newDiscussion,
  findOpenDiscussion,
  discussionErrors,
  syncFeatureDiscussion,
  syncFeatureDiscussionSafely,
} from '../lib/discussions.js';

const SUMMARY_SYSTEM_PROMPT = `You are an internal operations assistant. Collate the following dated internal note entries about a single roadmap feature into one concise summary for internal stakeholders.
Write 2 to 4 short plain-text paragraphs. Do NOT use markdown formatting, headings, bullet points, or code blocks — plain prose only.
Do NOT use em-dashes (—) anywhere in the output. Use a colon, comma, or rewrite the sentence instead.
Preserve important dates, decisions, and open questions. Attribute key decisions to their author where relevant.
You MUST return a valid JSON object only with this exact shape (do NOT wrap the JSON in markdown code blocks like \`\`\`json):
{
  "summary": "The collated plain-text summary"
}`;

export default async function featureNotesRoutes(fastify, options) {
  const discussionContainers = { featuresContainer, revisionsContainer };

  const sendError = (reply, e) => reply.code(e.status).send({ statusCode: e.status, error: e.error, message: e.message });

  async function loadNotes(featureId, order = 'DESC') {
    const { resources } = await featureNotesContainer.items
      .query(
        {
          query: `SELECT * FROM c WHERE c.featureId = @fid ORDER BY c.createdAt ${order}`,
          parameters: [{ name: '@fid', value: featureId }],
        },
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();
    return resources;
  }

  // Returns the note, or sends a 404 that explains what happened and returns null.
  async function readNoteOr404(featureId, noteId, reply) {
    try {
      const { resource } = await featureNotesContainer.item(noteId, featureId).read();
      if (resource) return resource;
    } catch (err) {
      if (err.code !== 404 && err.statusCode !== 404) throw err;
    }
    sendError(reply, discussionErrors.notFound());
    return null;
  }

  // Re-derive the feature's flag after a note change. Never throws: a sync problem
  // is reported to the client as `warning` instead of hiding that the note was saved.
  const syncAfterChange = (featureId, notes, request) =>
    syncFeatureDiscussionSafely(discussionContainers, featureId, notes, request.user, request.log);

  const withWarning = (note, warning) => (warning ? { ...note, warning } : note);

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

    return loadNotes(id);
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
          discussion_point: { type: 'boolean' },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params;
    if (!(await ensureFeatureExists(id, reply))) return;

    const isDiscussion = request.body.discussion_point === true;
    let existingNotes = [];
    if (isDiscussion) {
      existingNotes = await loadNotes(id);
      const open = findOpenDiscussion(existingNotes);
      if (open) return sendError(reply, discussionErrors.alreadyOpen(open));
    }

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
      ...(isDiscussion ? { discussion: newDiscussion() } : {}),
    };
    const { resource } = await featureNotesContainer.items.create(doc);

    const warning = isDiscussion
      ? await syncAfterChange(id, [resource, ...existingNotes], request)
      : null;
    return reply.code(201).send(withWarning(resource, warning));
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

    const note = await readNoteOr404(id, noteId, reply);
    if (!note) return;

    if (note.authorId !== request.user.sub) {
      return sendError(reply, discussionErrors.notAuthor('edit', note));
    }

    const updated = {
      ...note,
      content: request.body.content,
      edited: true,
      updatedAt: new Date().toISOString(),
    };
    const { resource } = await featureNotesContainer.item(noteId, id).replace(updated);

    // An open discussion point's text is shown as a tooltip on the board, so keep it current.
    let warning = null;
    if (resource.discussion?.status === 'open') {
      const notes = (await loadNotes(id)).map((n) => (n.id === noteId ? resource : n));
      warning = await syncAfterChange(id, notes, request);
    }
    return withWarning(resource, warning);
  });

  // ── DELETE /:id/notes/:noteId — Admin: delete your own note entry ──────────
  fastify.delete('/:id/notes/:noteId', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id, noteId } = request.params;

    const note = await readNoteOr404(id, noteId, reply);
    if (!note) return;

    if (note.authorId !== request.user.sub) {
      return sendError(reply, discussionErrors.notAuthor('delete', note));
    }

    await featureNotesContainer.item(noteId, id).delete();

    // Deleting the open discussion point clears the feature's flag.
    let warning = null;
    if (note.discussion?.status === 'open') {
      const remaining = (await loadNotes(id)).filter((n) => n.id !== noteId);
      warning = await syncAfterChange(id, remaining, request);
    }
    return warning ? { ok: true, warning } : { ok: true };
  });

  // ── POST /:id/notes/:noteId/resolve — Admin: resolve an open discussion point ─
  fastify.post('/:id/notes/:noteId/resolve', {
    preHandler: [requireAdmin],
    schema: {
      body: {
        type: 'object',
        properties: {
          resolution: { type: 'string', maxLength: NOTE_MAX_LENGTH },
        },
      },
    },
  }, async (request, reply) => {
    const { id, noteId } = request.params;
    const note = await readNoteOr404(id, noteId, reply);
    if (!note) return;

    if (!note.discussion) return sendError(reply, discussionErrors.notADiscussion('resolved'));
    if (note.discussion.status === 'resolved') return sendError(reply, discussionErrors.alreadyResolved(note));

    const now = new Date().toISOString();
    const resolution = (request.body?.resolution ?? '').trim();
    const updated = {
      ...note,
      updatedAt: now,
      discussion: {
        ...note.discussion,
        status: 'resolved',
        resolution: resolution || null,
        resolvedAt: now,
        resolvedById: request.user.sub,
        resolvedByName: request.user.name,
      },
    };
    const { resource } = await featureNotesContainer.item(noteId, id).replace(updated);

    const notes = (await loadNotes(id)).map((n) => (n.id === noteId ? resource : n));
    const warning = await syncAfterChange(id, notes, request);
    return withWarning(resource, warning);
  });

  // ── POST /:id/notes/:noteId/reopen — Admin: reopen a resolved discussion point ─
  fastify.post('/:id/notes/:noteId/reopen', { preHandler: [requireAdmin] }, async (request, reply) => {
    const { id, noteId } = request.params;
    const note = await readNoteOr404(id, noteId, reply);
    if (!note) return;

    if (!note.discussion) return sendError(reply, discussionErrors.notADiscussion('reopened'));
    if (note.discussion.status === 'open') return sendError(reply, discussionErrors.alreadyOpenOnReopen());

    const allNotes = await loadNotes(id);
    const blocker = findOpenDiscussion(allNotes, { excludeId: noteId });
    if (blocker) return sendError(reply, discussionErrors.reopenBlocked(blocker));

    const updated = {
      ...note,
      updatedAt: new Date().toISOString(),
      discussion: { ...newDiscussion() },
    };
    const { resource } = await featureNotesContainer.item(noteId, id).replace(updated);

    const warning = await syncAfterChange(id, allNotes.map((n) => (n.id === noteId ? resource : n)), request);
    return withWarning(resource, warning);
  });

  // ── POST /admin/recount-discussions — Super admin: rebuild every feature's flag from its notes ─
  fastify.post('/admin/recount-discussions', { preHandler: [requireSuperAdmin] }, async (request) => {
    const { resources: features } = await featuresContainer.items.readAll().fetchAll();
    const { resources: allNotes } = await featureNotesContainer.items.readAll().fetchAll();

    const byFeature = {};
    for (const n of allNotes) (byFeature[n.featureId] ||= []).push(n);

    const results = { updated: 0, skipped: 0, errors: [] };
    for (const { id } of features) {
      try {
        const { changed } = await syncFeatureDiscussion(discussionContainers, id, byFeature[id] || [], request.user);
        if (changed) results.updated++; else results.skipped++;
      } catch (err) {
        results.errors.push({ featureId: id, error: err.message });
      }
    }
    return results;
  });

  // ── POST /:id/notes/summary — Admin: AI-collate all note entries ───────────
  fastify.post('/:id/notes/summary', {
    preHandler: [requireAdmin],
    config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
  }, async (request, reply) => {
    const { id } = request.params;

    if (!config.ai.configured) {
      return reply.code(503).send({ error: 'Azure OpenAI completions are not configured on the server.' });
    }
    if (!(await ensureFeatureExists(id, reply))) return;

    const notes = await loadNotes(id, 'ASC');

    if (notes.length === 0) {
      return reply.code(400).send({ error: 'No notes to summarise' });
    }

    const userMessage = notes
      .map(n => {
        const header = `[${n.createdAt} — ${n.authorName}]`;
        const d = n.discussion;
        const tag = d ? ` (discussion point, ${d.status})` : '';
        const resolution = d?.status === 'resolved' && d.resolution
          ? `\nResolution by ${d.resolvedByName}: ${tiptapToPlainText(d.resolution)}`
          : '';
        return `${header}${tag}\n${tiptapToPlainText(n.content)}${resolution}`;
      })
      .join('\n\n');

    let result;
    try {
      result = await callAzureOpenAI(SUMMARY_SYSTEM_PROMPT, userMessage, request);
    } catch (err) {
      request.log.error(err, 'Error generating notes summary');
      return reply.code(502).send({ error: 'Failed to generate summary via Azure OpenAI completions' });
    }

    if (typeof result.summary !== 'string' || !result.summary.trim()) {
      request.log.error({ result }, 'Azure OpenAI summary response missing a valid summary field');
      return reply.code(502).send({ error: 'Failed to generate summary via Azure OpenAI completions' });
    }

    const notesSummary = {
      content: result.summary,
      source: 'ai',
      noteCount: notes.length,
      generatedAt: new Date().toISOString(),
      generatedById: request.user.sub,
      generatedByName: request.user.name,
    };

    try {
      await featuresContainer.item(id, id).patch([
        { op: 'set', path: '/notes_summary', value: notesSummary },
      ]);
    } catch (err) {
      request.log.error(err, 'Failed to save notes summary to feature');
      return reply.code(500).send({ error: 'Summary generated but failed to save' });
    }

    return notesSummary;
  });

  // ── PUT /:id/notes/summary — Admin: manually update notes summary ──────────
  fastify.put('/:id/notes/summary', {
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

    const { resources: countResult } = await featureNotesContainer.items
      .query(
        {
          query: 'SELECT VALUE COUNT(1) FROM c WHERE c.featureId = @fid',
          parameters: [{ name: '@fid', value: id }],
        },
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();

    const notesSummary = {
      content: request.body.content,
      source: 'manual',
      noteCount: countResult[0] || 0,
      generatedAt: new Date().toISOString(),
      generatedById: request.user.sub,
      generatedByName: request.user.name,
    };

    try {
      await featuresContainer.item(id, id).patch([
        { op: 'set', path: '/notes_summary', value: notesSummary },
      ]);
    } catch (err) {
      request.log.error(err, 'Failed to update notes summary');
      return reply.code(500).send({ error: 'Failed to update summary' });
    }

    return notesSummary;
  });
}
