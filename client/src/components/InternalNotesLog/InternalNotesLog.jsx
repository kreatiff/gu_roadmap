import { useEffect, useState } from 'react';
import { Plus, Sparkles, Pencil, Trash2, X, Check, Lock, Paperclip, ChevronDown, MessageCircle, CheckCircle2, RotateCcw } from 'lucide-react';
import RichTextEditor from '../RichTextEditor';
import RichTextViewer, { getPlainTextFromRichText } from '../RichTextViewer';
import ConfirmDialog from '../ConfirmDialog';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import {
  getFeatureNotes,
  createFeatureNote,
  updateFeatureNote,
  deleteFeatureNote,
  resolveDiscussionPoint,
  reopenDiscussionPoint,
  getNoteErrorMessage,
} from '../../api/notes';
import { useNotesSummary, getLatestNoteActivityAt } from '../../hooks/useNotesSummary';
import styles from './InternalNotesLog.module.css';

const AVATAR_COLORS = [
  '#2F9E6E', '#8A6A3C', '#3B7DD8', '#B5537A', '#C1793A', '#6E63C7', '#4FA6A0',
  '#5C7CFA', '#A0522D', '#9C5FC7', '#5C8A3A', '#2B8A9E',
];

const getInitials = (name) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return (parts[0][0] + (parts[1]?.[0] || '')).toUpperCase();
};

const getAvatarColor = (name) => {
  const hash = (name || '').split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const formatTime = (isoString) => new Intl.DateTimeFormat('en-AU', {
  year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
}).format(new Date(isoString));

const formatClock = (date) => new Intl.DateTimeFormat('en-US', {
  hour: 'numeric', minute: '2-digit', hour12: true,
}).format(date);

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const formatRelativeTime = (isoString) => {
  const date = new Date(isoString);
  const time = formatClock(date);
  const dayDiff = Math.round((startOfDay(new Date()) - startOfDay(date)) / 86400000);

  if (dayDiff === 0) return `Today · ${time}`;
  if (dayDiff === 1) return `Yesterday · ${time}`;
  if (dayDiff > 1 && dayDiff < 7) return `${dayDiff} days ago · ${time}`;

  const day = new Intl.DateTimeFormat('en-AU', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
  return `${day} · ${time}`;
};

const ATTACHMENT_URL_RE = /(https?:\/\/\S+)/i;

// Legacy notes are stored as plain strings (not Tiptap JSON) and sometimes carry a
// raw file URL inline; pull it out so it can be rendered as a chip instead.
const extractAttachment = (content) => {
  if (typeof content !== 'string') return { body: content, attachment: null };
  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.type === 'doc') return { body: content, attachment: null };
  } catch {
    // not JSON — plain legacy text, fall through to URL extraction
  }
  const match = content.match(ATTACHMENT_URL_RE);
  if (!match) return { body: content, attachment: null };

  const url = match[1];
  const body = content.slice(0, match.index).trim() + content.slice(match.index + url.length).trim();
  let label;
  try {
    const path = decodeURIComponent(new URL(url).pathname);
    label = path.split('/').filter(Boolean).pop() || url;
  } catch {
    label = url;
  }
  return { body, attachment: { url, label } };
};

const formatShortDate = (isoString) => new Intl.DateTimeFormat('en-AU', {
  day: 'numeric', month: 'short', year: 'numeric',
}).format(new Date(isoString));

const describeNote = (note) => `added by ${note.authorName} on ${formatShortDate(note.createdAt)}`;

const InternalNotesLog = ({
  featureId,
  initialSummary = null,
  showSummary = true,
  notes: propNotes,
  setNotes: propSetNotes,
  collapsible = false,
  children,
}) => {
  const { user } = useAuth();
  const { addToast } = useToast();

  // Collapsed by default; only has a visual effect on narrow screens (see CSS) —
  // on desktop the sidebar always renders fully expanded regardless of this prop.
  const [expanded, setExpanded] = useState(false);

  const [localNotes, setLocalNotes] = useState([]);
  const notes = propNotes || localNotes;
  const setNotes = propSetNotes || setLocalNotes;

  const [loading, setLoading] = useState(!propNotes);
  const [draft, setDraft] = useState('');
  const [composerKey, setComposerKey] = useState(0);
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [isDiscussionDraft, setIsDiscussionDraft] = useState(false);
  const [resolvingId, setResolvingId] = useState(null);
  const [resolveDraft, setResolveDraft] = useState('');
  const [resolveKey, setResolveKey] = useState(0);
  const [busyNoteId, setBusyNoteId] = useState(null);
  const [reopenTarget, setReopenTarget] = useState(null);

  const {
    summary,
    summarising,
    aiConfigured,
    isStale,
    canSummarise,
    isEditingSummary,
    summaryEditDraft,
    setSummaryEditDraft,
    savingSummary,
    handleSummarise,
    startEditSummary,
    cancelEditSummary,
    handleSaveSummary,
  } = useNotesSummary({
    featureId,
    initialSummary,
    notesCount: notes.length,
    latestNoteActivityAt: getLatestNoteActivityAt(notes),
    enabled: showSummary,
  });
  const isManualSummary = summary?.source === 'manual';

  useEffect(() => {
    let cancelled = false;

    // Reset locally-owned note state when switching to a different feature
    setDraft('');
    setComposerKey((k) => k + 1);
    setEditingId(null);
    setEditDraft('');
    setDeleteTarget(null);
    setIsDiscussionDraft(false);
    setResolvingId(null);
    setResolveDraft('');
    setReopenTarget(null);

    if (!propNotes) {
      setLocalNotes([]);
      const load = async () => {
        setLoading(true);
        try {
          const data = await getFeatureNotes(featureId);
          if (!cancelled) setNotes(data);
        } catch {
          if (!cancelled) addToast('Failed to load notes', 'error');
        } finally {
          if (!cancelled) setLoading(false);
        }
      };
      load();
    } else {
      setLoading(false);
    }

    return () => { cancelled = true; };
  }, [featureId]);

  const draftIsEmpty = !getPlainTextFromRichText(draft)?.trim();

  // Only one discussion point can be open per feature, so the composer option and
  // the Reopen buttons are blocked (with the reason shown) while one is open.
  const openDiscussion = notes.find((n) => n.discussion?.status === 'open') || null;
  const addAsDiscussion = isDiscussionDraft && !openDiscussion;
  const alreadyOpenMessage = openDiscussion
    ? `A discussion point is already open on this feature (${describeNote(openDiscussion)}). Only one can be open at a time, so resolve it before adding another.`
    : '';
  const reopenBlockedMessage = (note) => (openDiscussion && openDiscussion.id !== note.id
    ? `This discussion point cannot be reopened because another discussion point on this feature (${describeNote(openDiscussion)}) is still open and unresolved. Resolve that one first, then reopen this one.`
    : '');

  // After a conflict (someone else resolved/deleted the note first) the list on screen is
  // out of date, so reload it rather than leaving the person looking at stale state.
  const refreshAfterConflict = async (err) => {
    if (err?.statusCode !== 409 && err?.statusCode !== 404) return;
    try { setNotes(await getFeatureNotes(featureId)); } catch { /* keep what is on screen */ }
  };

  const showWarning = (warning) => { if (warning) addToast(warning, 'error'); };

  const handlePost = async () => {
    if (draftIsEmpty) return;
    setPosting(true);
    try {
      const { warning, ...created } = await createFeatureNote(featureId, draft, { discussion: addAsDiscussion });
      setNotes((prev) => [created, ...prev]);
      setDraft('');
      setIsDiscussionDraft(false);
      setComposerKey((k) => k + 1);
      addToast(
        addAsDiscussion ? 'Discussion point added. This feature is now flagged for discussion.' : 'Note added',
        'success',
      );
      showWarning(warning);
    } catch (err) {
      addToast(getNoteErrorMessage(err, 'The note could not be added because of an unexpected error. Your text is still in the box, so try again.'), 'error');
      await refreshAfterConflict(err);
    } finally {
      setPosting(false);
    }
  };

  const startEdit = (note) => {
    setEditingId(note.id);
    setEditDraft(note.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
  };

  const saveEdit = async (noteId) => {
    try {
      const { warning, ...updated } = await updateFeatureNote(featureId, noteId, editDraft);
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
      setEditingId(null);
      setEditDraft('');
      addToast('Note updated', 'success');
      showWarning(warning);
    } catch (err) {
      addToast(getNoteErrorMessage(err, 'The note could not be updated because of an unexpected error. Your edit is still open, so try again.'), 'error');
      await refreshAfterConflict(err);
    }
  };

  const confirmDelete = async () => {
    const noteId = deleteTarget;
    const wasOpenDiscussion = notes.find((n) => n.id === noteId)?.discussion?.status === 'open';
    setDeleteTarget(null);
    try {
      const result = await deleteFeatureNote(featureId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      addToast(
        wasOpenDiscussion ? 'Discussion point deleted. This feature is no longer flagged for discussion.' : 'Note deleted',
        'success',
      );
      showWarning(result?.warning);
    } catch (err) {
      addToast(getNoteErrorMessage(err, 'The note could not be deleted because of an unexpected error. Try again.'), 'error');
      await refreshAfterConflict(err);
    }
  };

  const startResolve = (noteId) => {
    setResolvingId(noteId);
    setResolveDraft('');
    setResolveKey((k) => k + 1);
  };

  const cancelResolve = () => {
    setResolvingId(null);
    setResolveDraft('');
  };

  const confirmResolve = async (noteId) => {
    setBusyNoteId(noteId);
    try {
      const hasResolution = Boolean(getPlainTextFromRichText(resolveDraft)?.trim());
      const { warning, ...updated } = await resolveDiscussionPoint(featureId, noteId, hasResolution ? resolveDraft : '');
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
      cancelResolve();
      addToast('Discussion point resolved. This feature is no longer flagged for discussion.', 'success');
      showWarning(warning);
    } catch (err) {
      addToast(getNoteErrorMessage(err, 'The discussion point could not be resolved because of an unexpected error. Your resolution note is still open, so try again.'), 'error');
      await refreshAfterConflict(err);
    } finally {
      setBusyNoteId(null);
    }
  };

  const requestReopen = (note) => {
    const blocked = reopenBlockedMessage(note);
    if (blocked) {
      addToast(blocked, 'error');
      return;
    }
    setReopenTarget(note.id);
  };

  const confirmReopen = async () => {
    const noteId = reopenTarget;
    setReopenTarget(null);
    setBusyNoteId(noteId);
    try {
      const { warning, ...updated } = await reopenDiscussionPoint(featureId, noteId);
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
      addToast('Discussion point reopened. This feature is flagged for discussion again.', 'success');
      showWarning(warning);
    } catch (err) {
      addToast(getNoteErrorMessage(err, 'The discussion point could not be reopened because of an unexpected error. Try again.'), 'error');
      await refreshAfterConflict(err);
    } finally {
      setBusyNoteId(null);
    }
  };

  const deleteTargetNote = notes.find((n) => n.id === deleteTarget) || null;
  const deleteMessage = deleteTargetNote?.discussion?.status === 'open'
    ? 'This open discussion point will be permanently deleted and the feature will no longer be flagged for discussion. This cannot be undone.'
    : deleteTargetNote?.discussion
      ? 'This discussion point and its resolution will be permanently deleted. This cannot be undone.'
      : 'This note entry will be permanently deleted. This cannot be undone.';

  return (
    <div className={styles.wrapper} data-collapsible={collapsible} data-expanded={expanded}>
      <div
        className={styles.header}
        onClick={collapsible ? () => setExpanded((v) => !v) : undefined}
        role={collapsible ? 'button' : undefined}
        aria-expanded={collapsible ? expanded : undefined}
        tabIndex={collapsible ? 0 : undefined}
        onKeyDown={collapsible ? (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        } : undefined}
      >
        <span className={styles.headerLabel}>Internal Notes</span>
        <span className={styles.headerBadge}><Lock size={10} /> Admin only</span>
        {collapsible && <ChevronDown size={16} className={styles.accordionChevron} />}
      </div>

      <div className={styles.body}>
      {showSummary && aiConfigured && (
        <div className={styles.summaryPanel}>
          {summary ? (
            <>
              <div className={styles.summaryMeta}>
                <span>{isManualSummary ? 'Written' : 'Generated'} by {summary.generatedByName} on {formatTime(summary.generatedAt)}</span>
                {isStale && <span className={styles.staleBadge}>New notes since this summary</span>}
              </div>
              {isEditingSummary ? (
                <div className={styles.editArea}>
                  <RichTextEditor value={summaryEditDraft} onChange={setSummaryEditDraft} />
                  <div className={styles.editActions}>
                    <button type="button" onClick={handleSaveSummary} className={styles.saveBtn} disabled={savingSummary}>
                      <Check size={13} /> {savingSummary ? 'Saving…' : 'Save'}
                    </button>
                    <button type="button" onClick={cancelEditSummary} className={styles.cancelBtn}>
                      <X size={13} /> Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <RichTextViewer content={summary.content} className={styles.summaryContent} />
              )}
            </>
          ) : (
            <p className={styles.summaryEmpty}>No summary yet.</p>
          )}
          <div className={styles.summaryActions}>
            <button
              type="button"
              className={styles.summariseBtn}
              onClick={handleSummarise}
              disabled={summarising || !canSummarise || isEditingSummary}
              title={!canSummarise ? 'Add at least one note first' : undefined}
            >
              <Sparkles size={14} />
              {summarising ? 'Summarising…' : summary ? 'Regenerate summary' : 'Summarise notes'}
            </button>
            {summary && !isEditingSummary && (
              <button
                type="button"
                className={styles.summariseBtn}
                onClick={startEditSummary}
              >
                <Pencil size={14} />
                Edit summary
              </button>
            )}
          </div>
        </div>
      )}

      <div className={styles.composer}>
        <RichTextEditor
          key={composerKey}
          value={draft}
          onChange={setDraft}
          placeholder="Add an internal note…"
          className={styles.composerEditorWrapper}
          editorClassName={styles.noteEditorContent}
        />
        <div className={styles.composerFooter}>
          <label
            className={`${styles.discussionOption} ${openDiscussion ? styles.discussionOptionBlocked : ''}`}
            title={alreadyOpenMessage || undefined}
          >
            <input
              type="checkbox"
              checked={addAsDiscussion}
              disabled={Boolean(openDiscussion) || posting}
              onChange={(e) => setIsDiscussionDraft(e.target.checked)}
            />
            <MessageCircle size={13} />
            Discussion point
          </label>
          <button
            type="button"
            className={styles.postBtn}
            onClick={handlePost}
            disabled={posting || draftIsEmpty}
          >
            <Plus size={14} />
            {posting ? 'Posting…' : addAsDiscussion ? 'Add discussion point' : 'Add note'}
          </button>
        </div>
        {openDiscussion && (
          <p className={styles.discussionHint}>{alreadyOpenMessage}</p>
        )}
        {addAsDiscussion && (
          <p className={styles.discussionHint}>
            This will flag the feature for discussion until the point is resolved.
          </p>
        )}
      </div>

      {children}

      {loading ? (
        <p className={styles.loading}>Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className={styles.empty}>No internal notes yet.</p>
      ) : (
        <ul className={styles.list}>
          {notes.map((note) => {
            const { body, attachment } = extractAttachment(note.content);
            return (
              <li
                key={note.id}
                className={`${styles.entry} ${note.discussion?.status === 'open' ? styles.entryDiscussionOpen : ''} ${note.discussion?.status === 'resolved' ? styles.entryDiscussionResolved : ''}`}
              >
                <div className={styles.entryHeader}>
                  <div className={styles.avatar} style={{ backgroundColor: getAvatarColor(note.authorName) }}>
                    {getInitials(note.authorName)}
                  </div>
                  <div className={styles.entryIdentity}>
                    <span className={styles.author}>{note.authorName}</span>
                    <span className={styles.date}>
                      {formatRelativeTime(note.createdAt)}{note.edited ? ' (edited)' : ''}
                    </span>
                  </div>
                  {note.discussion && (
                    <span className={note.discussion.status === 'open' ? styles.pillOpen : styles.pillResolved}>
                      {note.discussion.status === 'open' ? <MessageCircle size={11} strokeWidth={2.5} /> : <CheckCircle2 size={11} strokeWidth={2.5} />}
                      {note.discussion.status === 'open' ? 'Discussion' : 'Resolved'}
                    </span>
                  )}
                  {note.authorId === user?.id && editingId !== note.id && (
                    <span className={styles.entryActions}>
                      <button
                        type="button"
                        className={styles.iconBtn}
                        onClick={() => startEdit(note)}
                        aria-label="Edit note"
                        disabled={editingId !== null}
                        title={editingId !== null ? 'Finish or cancel your current edit first' : undefined}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className={`${styles.iconBtn} ${styles.deleteIconBtn}`}
                        onClick={() => setDeleteTarget(note.id)}
                        aria-label="Delete note"
                        disabled={editingId !== null}
                        title={editingId !== null ? 'Finish or cancel your current edit first' : undefined}
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  )}
                </div>

                {editingId === note.id ? (
                  <div className={styles.editArea}>
                    <RichTextEditor
                      value={editDraft}
                      onChange={setEditDraft}
                      className={styles.composerEditorWrapper}
                      editorClassName={styles.noteEditorContent}
                    />
                    <div className={styles.editActions}>
                      <button type="button" onClick={() => saveEdit(note.id)} className={styles.saveBtn}>
                        <Check size={13} /> Save
                      </button>
                      <button type="button" onClick={cancelEdit} className={styles.cancelBtn}>
                        <X size={13} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.entryBody}>
                    <RichTextViewer content={body} className={styles.entryContent} />
                    {attachment && (
                      <a
                        className={styles.attachmentChip}
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Paperclip size={12} />
                        <span>{attachment.label}</span>
                      </a>
                    )}

                    {note.discussion?.status === 'open' && resolvingId !== note.id && (
                      <div className={styles.discussionActions}>
                        <button
                          type="button"
                          className={styles.resolveBtn}
                          onClick={() => startResolve(note.id)}
                          disabled={busyNoteId === note.id}
                        >
                          <CheckCircle2 size={13} /> Resolve
                        </button>
                      </div>
                    )}

                    {note.discussion?.status === 'open' && resolvingId === note.id && (
                      <div className={styles.resolveArea}>
                        <RichTextEditor
                          key={resolveKey}
                          value={resolveDraft}
                          onChange={setResolveDraft}
                          placeholder="Add a resolution note (optional)…"
                          className={styles.composerEditorWrapper}
                          editorClassName={styles.noteEditorContent}
                        />
                        <div className={styles.editActions}>
                          <button
                            type="button"
                            className={styles.resolveConfirmBtn}
                            onClick={() => confirmResolve(note.id)}
                            disabled={busyNoteId === note.id}
                          >
                            <Check size={13} /> {busyNoteId === note.id ? 'Resolving…' : 'Resolve discussion'}
                          </button>
                          <button type="button" onClick={cancelResolve} className={styles.cancelBtn} disabled={busyNoteId === note.id}>
                            <X size={13} /> Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {note.discussion?.status === 'resolved' && (
                      <div className={styles.resolutionBlock}>
                        <div className={styles.resolutionMeta}>
                          <CheckCircle2 size={13} />
                          <span>
                            Resolved by {note.discussion.resolvedByName}
                            {note.discussion.resolvedAt ? ` · ${formatRelativeTime(note.discussion.resolvedAt)}` : ''}
                          </span>
                        </div>
                        {note.discussion.resolution ? (
                          <RichTextViewer content={note.discussion.resolution} className={styles.entryContent} />
                        ) : (
                          <p className={styles.resolutionEmpty}>Resolved without a resolution note.</p>
                        )}
                        <div className={styles.discussionActions}>
                          <button
                            type="button"
                            className={`${styles.reopenBtn} ${reopenBlockedMessage(note) ? styles.reopenBtnBlocked : ''}`}
                            onClick={() => requestReopen(note)}
                            disabled={busyNoteId === note.id}
                            aria-disabled={Boolean(reopenBlockedMessage(note))}
                            title={reopenBlockedMessage(note) || undefined}
                          >
                            <RotateCcw size={13} /> Reopen
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      </div>

      {deleteTarget && (
        <ConfirmDialog
          title={deleteTargetNote?.discussion ? 'Delete discussion point' : 'Delete note'}
          message={deleteMessage}
          confirmText="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          variant="danger"
        />
      )}

      {reopenTarget && (
        <ConfirmDialog
          title="Reopen discussion point"
          message="Reopening removes this discussion point's resolution note and flags the feature for discussion again."
          confirmText="Reopen"
          onConfirm={confirmReopen}
          onCancel={() => setReopenTarget(null)}
          variant="primary"
        />
      )}
    </div>
  );
};

export default InternalNotesLog;
