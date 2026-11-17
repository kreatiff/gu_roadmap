import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  toSnippet,
  findOpenDiscussion,
  deriveDiscussionState,
  discussionErrors,
  syncFeatureDiscussion,
  syncFeatureDiscussionSafely,
  newDiscussion,
} from './discussions.js';

const note = (id, createdAt, discussion, extra = {}) => ({
  id, featureId: 'f1', content: `<p>Note ${id}</p>`, authorName: 'Alex Admin', createdAt, discussion, ...extra,
});
const open = () => newDiscussion();
const resolved = () => ({ ...newDiscussion(), status: 'resolved', resolution: 'Agreed', resolvedByName: 'Sam', resolvedAt: '2026-11-02T00:00:00Z' });

function fakeContainers(feature, { patchError } = {}) {
  const calls = { patches: [], revisions: [] };
  return {
    calls,
    featuresContainer: {
      item: () => ({
        read: async () => ({ resource: feature }),
        patch: async (ops) => {
          if (patchError) throw patchError;
          calls.patches.push(ops);
        },
      }),
    },
    revisionsContainer: { items: { create: async (doc) => { calls.revisions.push(doc); } } },
  };
}

describe('toSnippet', () => {
  it('strips tags and collapses whitespace', () => {
    assert.equal(toSnippet('<p>Hello&nbsp;<strong>big</strong></p>\n<p>world</p>'), 'Hello big world');
  });
  it('truncates long text with an ellipsis', () => {
    const out = toSnippet('x'.repeat(500), 50);
    assert.equal(out.length, 50);
    assert.ok(out.endsWith('…'));
  });
});

describe('deriveDiscussionState', () => {
  it('is unflagged with no discussion notes', () => {
    assert.deepEqual(deriveDiscussionState([note('a', '2026-11-01T00:00:00Z')]), { flagged: false, text: null });
  });
  it('is unflagged when every discussion point is resolved', () => {
    assert.equal(deriveDiscussionState([note('a', '2026-11-01T00:00:00Z', resolved())]).flagged, false);
  });
  it('is flagged with the open note text', () => {
    assert.deepEqual(
      deriveDiscussionState([note('a', '2026-11-01T00:00:00Z', resolved()), note('b', '2026-11-03T00:00:00Z', open())]),
      { flagged: true, text: 'Note b' },
    );
  });
  it('picks the newest if data somehow has two open points, and can exclude one', () => {
    const notes = [note('a', '2026-11-01T00:00:00Z', open()), note('b', '2026-11-03T00:00:00Z', open())];
    assert.equal(findOpenDiscussion(notes).id, 'b');
    assert.equal(findOpenDiscussion(notes, { excludeId: 'b' }).id, 'a');
  });
});

describe('error messages explain what is blocked and what to do', () => {
  const blocker = note('b', '2026-11-03T00:00:00Z', open(), { authorName: 'Jo Blocker' });

  it('reopenBlocked names the blocking note and says to resolve it first', () => {
    const e = discussionErrors.reopenBlocked(blocker);
    assert.equal(e.status, 409);
    assert.match(e.message, /cannot be reopened because another discussion point/);
    assert.match(e.message, /Jo Blocker/);
    assert.match(e.message, /still open and unresolved/);
    assert.match(e.message, /Resolve that one first/);
  });
  it('alreadyOpen names the open point and the one-at-a-time rule', () => {
    const e = discussionErrors.alreadyOpen(blocker);
    assert.equal(e.status, 409);
    assert.match(e.message, /Jo Blocker/);
    assert.match(e.message, /Only one discussion point can be open at a time/);
  });
  it('alreadyResolved says who resolved it', () => {
    assert.match(discussionErrors.alreadyResolved(note('a', '2026-11-01T00:00:00Z', resolved())).message, /resolved by Sam/);
  });
  it('notAuthor says whose note it is', () => {
    const e = discussionErrors.notAuthor('delete', blocker);
    assert.equal(e.status, 403);
    assert.match(e.message, /written by Jo Blocker/);
  });
});

describe('syncFeatureDiscussion', () => {
  const user = { email: 'admin@example.edu' };

  it('flags the feature, stores the text and logs a revision when a point opens', async () => {
    const c = fakeContainers({ id: 'f1', flagged_for_discussion: false });
    const res = await syncFeatureDiscussion(c, 'f1', [note('a', '2026-11-01T00:00:00Z', open())], user);
    assert.equal(res.changed, true);
    assert.deepEqual(c.calls.patches[0], [
      { op: 'set', path: '/flagged_for_discussion', value: true },
      { op: 'set', path: '/discussion_text', value: 'Note a' },
    ]);
    assert.equal(c.calls.revisions.length, 1);
    assert.deepEqual(c.calls.revisions[0].changes.fields.flagged_for_discussion, { old: false, new: true });
    assert.equal(c.calls.revisions[0].changed_by, 'admin@example.edu');
  });

  it('leaves a legacy feature with no discussion fields untouched when nothing is open', async () => {
    const c = fakeContainers({ id: 'f1' });
    const res = await syncFeatureDiscussion(c, 'f1', [note('a', '2026-11-01T00:00:00Z')], user);
    assert.equal(res.changed, false);
    assert.equal(c.calls.patches.length, 0);
    assert.equal(c.calls.revisions.length, 0);
  });

  it('does nothing when the feature already matches its notes', async () => {
    const c = fakeContainers({ id: 'f1', flagged_for_discussion: true, discussion_text: 'Note a' });
    const res = await syncFeatureDiscussion(c, 'f1', [note('a', '2026-11-01T00:00:00Z', open())], user);
    assert.equal(res.changed, false);
    assert.equal(c.calls.patches.length, 0);
    assert.equal(c.calls.revisions.length, 0);
  });

  it('updates the tooltip text without a revision when only the note text changed', async () => {
    const c = fakeContainers({ id: 'f1', flagged_for_discussion: true, discussion_text: 'Old text' });
    await syncFeatureDiscussion(c, 'f1', [note('a', '2026-11-01T00:00:00Z', open())], user);
    assert.equal(c.calls.patches.length, 1);
    assert.equal(c.calls.revisions.length, 0);
  });

  it('clears the flag and logs a revision when the open point is resolved or deleted', async () => {
    const c = fakeContainers({ id: 'f1', flagged_for_discussion: true, discussion_text: 'Note a' });
    await syncFeatureDiscussion(c, 'f1', [note('a', '2026-11-01T00:00:00Z', resolved())], user);
    assert.deepEqual(c.calls.patches[0][0], { op: 'set', path: '/flagged_for_discussion', value: false });
    assert.deepEqual(c.calls.patches[0][1], { op: 'set', path: '/discussion_text', value: null });
    assert.deepEqual(c.calls.revisions[0].changes.fields.flagged_for_discussion, { old: true, new: false });
  });

  it('reports a missing feature instead of throwing', async () => {
    const c = fakeContainers(null);
    assert.deepEqual(await syncFeatureDiscussion(c, 'f1', [], user), { changed: false, missing: true });
  });
});

describe('syncFeatureDiscussionSafely', () => {
  it('returns an explanatory warning rather than throwing when the write fails', async () => {
    const c = fakeContainers({ id: 'f1', flagged_for_discussion: false }, { patchError: new Error('Cosmos timeout') });
    const warning = await syncFeatureDiscussionSafely(c, 'f1', [note('a', '2026-11-01T00:00:00Z', open())], null, null);
    assert.match(warning, /The note was saved, but the feature's discussion flag could not be updated \(Cosmos timeout\)/);
  });
  it('returns null on success', async () => {
    const c = fakeContainers({ id: 'f1', flagged_for_discussion: false });
    assert.equal(await syncFeatureDiscussionSafely(c, 'f1', [note('a', '2026-11-01T00:00:00Z', open())], null, null), null);
  });
});
