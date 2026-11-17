import { v4 as uuidv4 } from 'uuid';

/**
 * Discussion points live on internal notes (note.discussion). The feature's
 * flagged_for_discussion / discussion_text fields are DERIVED from its notes and
 * only ever written by syncFeatureDiscussion, so the two cannot be edited out of step.
 *
 * Everything here is free of database imports so it can be unit tested with
 * fake containers (see discussions.test.js).
 */

export const DISCUSSION_TEXT_MAX = 300;

export function tiptapToPlainText(content) {
  if (!content) return '';
  try {
    const json = typeof content === 'string' ? JSON.parse(content) : content;
    if (!json || json.type !== 'doc') return String(content);
    const extract = (nodes) => (nodes || []).reduce((acc, node) => {
      if (node.text) return acc + node.text;
      if (node.content) return acc + ' ' + extract(node.content);
      return acc + ' ';
    }, '').trim();
    return extract(json.content);
  } catch {
    return String(content);
  }
}

// Notes may be Tiptap JSON, HTML or legacy plain text. For the tooltip snippet
// strip tags and collapse whitespace so it reads as one clean line of text.
export function toSnippet(content, max = DISCUSSION_TEXT_MAX) {
  const text = tiptapToPlainText(content)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function formatDate(iso) {
  return new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
}

export function describeNote(note) {
  return `added by ${note.authorName} on ${formatDate(note.createdAt)}`;
}

export function newDiscussion() {
  return { status: 'open', resolution: null, resolvedAt: null, resolvedById: null, resolvedByName: null };
}

export function findOpenDiscussion(notes, { excludeId } = {}) {
  const open = notes.filter((n) => n.discussion?.status === 'open' && n.id !== excludeId);
  open.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return open[0] || null;
}

export function deriveDiscussionState(notes) {
  const open = findOpenDiscussion(notes);
  return { flagged: Boolean(open), text: open ? toSnippet(open.content) : null };
}

/**
 * Every error a person can hit around discussion points. Each message says what
 * went wrong AND what to do about it, because the UI shows them verbatim.
 */
export const discussionErrors = {
  alreadyOpen: (open) => ({
    status: 409,
    error: 'A discussion point is already open',
    message: `This feature already has an open discussion point (${describeNote(open)}). Only one discussion point can be open at a time, so resolve that one before adding another.`,
  }),
  notFound: () => ({
    status: 404,
    error: 'Note not found',
    message: 'This note no longer exists. It may have been deleted by its author. Refresh the page to see the current notes.',
  }),
  notADiscussion: (action) => ({
    status: 400,
    error: 'Not a discussion point',
    message: `This note is not a discussion point, so it cannot be ${action}. Only notes that were added as discussion points can be resolved or reopened.`,
  }),
  alreadyResolved: (note) => ({
    status: 409,
    error: 'Discussion point already resolved',
    message: `This discussion point was already resolved${note.discussion?.resolvedByName ? ` by ${note.discussion.resolvedByName}` : ''}${note.discussion?.resolvedAt ? ` on ${formatDate(note.discussion.resolvedAt)}` : ''}. Refresh the page to see their resolution.`,
  }),
  alreadyOpenOnReopen: () => ({
    status: 409,
    error: 'Discussion point is already open',
    message: 'This discussion point is already open, so it cannot be reopened. Refresh the page to see its current state.',
  }),
  reopenBlocked: (open) => ({
    status: 409,
    error: 'Cannot reopen this discussion point',
    message: `This discussion point cannot be reopened because another discussion point on this feature (${describeNote(open)}) is still open and unresolved. Resolve that one first, then reopen this one.`,
  }),
  notAuthor: (verb, note) => ({
    status: 403,
    error: `You can only ${verb} your own notes`,
    message: `You cannot ${verb} this note because it was written by ${note.authorName}. Only the author can ${verb} a note.`,
  }),
  syncFailed: (err) =>
    `The note was saved, but the feature's discussion flag could not be updated (${err?.message || 'unknown error'}). The board may not show the flag correctly until a super admin runs the discussion recount, or you save this note again.`,
};

// Read a Cosmos item without caring whether this SDK version throws on 404 or
// returns an empty resource.
async function readItem(container, id, partitionKey) {
  try {
    const { resource } = await container.item(id, partitionKey).read();
    return resource || null;
  } catch (err) {
    if (err.code === 404 || err.statusCode === 404) return null;
    throw err;
  }
}

/**
 * Recompute a feature's discussion flag and tooltip text from its notes and write
 * them only if something changed. A flag flip is recorded in revision history.
 * `notes` must be the feature's full, current note list.
 */
export async function syncFeatureDiscussion({ featuresContainer, revisionsContainer }, featureId, notes, user) {
  const feature = await readItem(featuresContainer, featureId, featureId);
  if (!feature) return { changed: false, missing: true };

  const { flagged, text } = deriveDiscussionState(notes);
  const wasFlagged = Boolean(feature.flagged_for_discussion);
  const oldText = feature.discussion_text ?? null;
  if (wasFlagged === flagged && oldText === text) return { changed: false, flagged };

  await featuresContainer.item(featureId, featureId).patch([
    { op: 'set', path: '/flagged_for_discussion', value: flagged },
    { op: 'set', path: '/discussion_text', value: text },
  ]);

  if (wasFlagged !== flagged) {
    await revisionsContainer.items.create({
      id: uuidv4(),
      featureId,
      changed_by: user?.email ?? 'System',
      changed_at: new Date().toISOString(),
      changes: {
        action: 'updated',
        fields: { flagged_for_discussion: { old: wasFlagged, new: flagged } },
      },
    });
  }
  return { changed: true, flagged };
}

/** syncFeatureDiscussion that never throws; returns a warning string for the client instead. */
export async function syncFeatureDiscussionSafely(containers, featureId, notes, user, log) {
  try {
    await syncFeatureDiscussion(containers, featureId, notes, user);
    return null;
  } catch (err) {
    log?.error?.(err, `Failed to sync discussion flag for feature ${featureId}`);
    return discussionErrors.syncFailed(err);
  }
}
