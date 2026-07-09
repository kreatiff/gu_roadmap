import { v4 as uuidv4 } from 'uuid';
import { requireAdmin } from '../auth.js';
import { config } from '../config.js';
import { featuresContainer, featureNotesContainer } from '../db.js';
import { NOTE_MAX_LENGTH } from '../constants.js';
import { callAzureOpenAI } from '../lib/azureOpenAI.js';

const SUMMARY_SYSTEM_PROMPT = `You are an internal operations assistant. Collate the following dated internal note entries about a single roadmap feature into one concise summary for internal stakeholders.
Write 2 to 4 short plain-text paragraphs. Do NOT use markdown formatting, headings, bullet points, or code blocks — plain prose only.
Do NOT use em-dashes (—) anywhere in the output. Use a colon, comma, or rewrite the sentence instead.
Preserve important dates, decisions, and open questions. Attribute key decisions to their author where relevant.
You MUST return a valid JSON object only with this exact shape (do NOT wrap the JSON in markdown code blocks like \`\`\`json):
{
  "summary": "The collated plain-text summary"
}`;

function tiptapToPlainText(content) {
  if (!content) return '';
  try {
    const json = typeof content === 'string' ? JSON.parse(content) : content;
    if (!json || json.type !== 'doc') return String(content);
    const extract = (nodes) => (nodes || []).reduce((acc, node) => {
      if (node.text) return acc + node.text;
      if (node.content) return acc + ' ' + extract(node.content);
      return acc;
    }, '').trim();
    return extract(json.content);
  } catch {
    return String(content);
  }
}

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

    const { resources: notes } = await featureNotesContainer.items
      .query(
        {
          query: 'SELECT * FROM c WHERE c.featureId = @fid ORDER BY c.createdAt ASC',
          parameters: [{ name: '@fid', value: id }],
        },
        { enableCrossPartitionQuery: true }
      )
      .fetchAll();

    if (notes.length === 0) {
      return reply.code(400).send({ error: 'No notes to summarise' });
    }

    const userMessage = notes
      .map(n => `[${n.createdAt} — ${n.authorName}]\n${tiptapToPlainText(n.content)}`)
      .join('\n\n');

    let result;
    try {
      result = await callAzureOpenAI(SUMMARY_SYSTEM_PROMPT, userMessage, request);
    } catch (err) {
      request.log.error(err, 'Error generating notes summary');
      return reply.code(502).send({ error: 'Failed to generate summary via Azure OpenAI completions' });
    }

    const notesSummary = {
      content: result.summary || '',
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
}
