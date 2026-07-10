import { useEffect, useState } from 'react';
import { Plus, Sparkles, Pencil, Trash2, X, Check, Lock, Paperclip, ChevronDown } from 'lucide-react';
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

const InternalNotesLog = ({
  featureId,
  initialSummary = null,
  showSummary = true,
  notes: propNotes,
  setNotes: propSetNotes,
  collapsible = false,
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

  const handlePost = async () => {
    if (draftIsEmpty) return;
    setPosting(true);
    try {
      const created = await createFeatureNote(featureId, draft);
      setNotes((prev) => [created, ...prev]);
      setDraft('');
      setComposerKey((k) => k + 1);
      addToast('Note added', 'success');
    } catch {
      addToast('Failed to add note', 'error');
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
      const updated = await updateFeatureNote(featureId, noteId, editDraft);
      setNotes((prev) => prev.map((n) => (n.id === noteId ? updated : n)));
      setEditingId(null);
      setEditDraft('');
      addToast('Note updated', 'success');
    } catch {
      addToast('Failed to update note', 'error');
    }
  };

  const confirmDelete = async () => {
    const noteId = deleteTarget;
    setDeleteTarget(null);
    try {
      await deleteFeatureNote(featureId, noteId);
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
      addToast('Note deleted', 'success');
    } catch {
      addToast('Failed to delete note', 'error');
    }
  };

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
        <button
          type="button"
          className={styles.postBtn}
          onClick={handlePost}
          disabled={posting || draftIsEmpty}
        >
          <Plus size={14} />
          {posting ? 'Posting…' : 'Add note'}
        </button>
      </div>

      {loading ? (
        <p className={styles.loading}>Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className={styles.empty}>No internal notes yet.</p>
      ) : (
        <ul className={styles.list}>
          {notes.map((note) => {
            const { body, attachment } = extractAttachment(note.content);
            return (
              <li key={note.id} className={styles.entry}>
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
          title="Delete note"
          message="This note entry will be permanently deleted. This cannot be undone."
          confirmText="Delete"
          onConfirm={confirmDelete}
          onCancel={() => setDeleteTarget(null)}
          variant="danger"
        />
      )}
    </div>
  );
};

export default InternalNotesLog;
