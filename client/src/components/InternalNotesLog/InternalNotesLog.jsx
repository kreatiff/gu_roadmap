import { useEffect, useState } from 'react';
import { MessageSquarePlus, Sparkles, Pencil, Trash2, X, Check } from 'lucide-react';
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
  generateNotesSummary,
  updateNotesSummary,
} from '../../api/notes';
import { fetchJiraConfig } from '../../api/jira';
import styles from './InternalNotesLog.module.css';

const formatTime = (isoString) => {
  return new Intl.DateTimeFormat('en-AU', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(isoString));
};

const InternalNotesLog = ({ featureId, initialSummary = null }) => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [composerKey, setComposerKey] = useState(0);
  const [posting, setPosting] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [summary, setSummary] = useState(initialSummary);
  const [summarising, setSummarising] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryEditDraft, setSummaryEditDraft] = useState('');
  const [savingSummary, setSavingSummary] = useState(false);

  useEffect(() => {
    let cancelled = false;

    // Reset all locally-owned state when switching to a different feature
    setSummary(initialSummary);
    setDraft('');
    setComposerKey((k) => k + 1);
    setEditingId(null);
    setEditDraft('');
    setDeleteTarget(null);
    setIsEditingSummary(false);
    setSummaryEditDraft('');

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

    fetchJiraConfig()
      .then((cfg) => { if (!cancelled) setAiConfigured(!!cfg.aiConfigured); })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [featureId]);

  const draftIsEmpty = !getPlainTextFromRichText(draft)?.trim();
  const newestCreatedAt = notes[0]?.createdAt || null;
  const isStale = summary && newestCreatedAt && new Date(newestCreatedAt) > new Date(summary.generatedAt);

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

  const handleSummarise = async () => {
    setSummarising(true);
    try {
      const result = await generateNotesSummary(featureId);
      setSummary(result);
      addToast('Summary generated', 'success');
    } catch (err) {
      addToast(err.error || 'Failed to generate summary', 'error');
    } finally {
      setSummarising(false);
    }
  };

  const startEditSummary = () => {
    setIsEditingSummary(true);
    setSummaryEditDraft(summary.content);
  };

  const cancelEditSummary = () => {
    setIsEditingSummary(false);
    setSummaryEditDraft('');
  };

  const handleSaveSummary = async () => {
    if (!summaryEditDraft.trim()) return;
    setSavingSummary(true);
    try {
      const updated = await updateNotesSummary(featureId, summaryEditDraft);
      setSummary(updated);
      setIsEditingSummary(false);
      setSummaryEditDraft('');
      addToast('Summary updated', 'success');
    } catch {
      addToast('Failed to update summary', 'error');
    } finally {
      setSavingSummary(false);
    }
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>Internal Notes</span>
        <span className={styles.headerBadge}>Admin Only</span>
      </div>

       {aiConfigured && (
        <div className={styles.summaryPanel}>
          {summary ? (
            <>
              <div className={styles.summaryMeta}>
                <span>Generated by {summary.generatedByName} on {formatTime(summary.generatedAt)}</span>
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
              disabled={summarising || notes.length === 0 || isEditingSummary}
              title={notes.length === 0 ? 'Add at least one note first' : undefined}
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
        <RichTextEditor key={composerKey} value={draft} onChange={setDraft} placeholder="Add an internal note…" />
        <button
          type="button"
          className={styles.postBtn}
          onClick={handlePost}
          disabled={posting || draftIsEmpty}
        >
          <MessageSquarePlus size={14} />
          {posting ? 'Posting…' : 'Add note'}
        </button>
      </div>

      {loading ? (
        <p className={styles.loading}>Loading notes…</p>
      ) : notes.length === 0 ? (
        <p className={styles.empty}>No internal notes yet.</p>
      ) : (
        <ul className={styles.list}>
          {notes.map((note) => (
            <li key={note.id} className={styles.entry}>
              <div className={styles.entryMeta}>
                <span className={styles.author}>{note.authorName}</span>
                <span className={styles.date}>
                  {formatTime(note.createdAt)}{note.edited ? ' (edited)' : ''}
                </span>
                {note.authorId === user?.id && editingId !== note.id && (
                  <span className={styles.entryActions}>
                    <button type="button" onClick={() => startEdit(note)} aria-label="Edit note">
                      <Pencil size={13} />
                    </button>
                    <button type="button" onClick={() => setDeleteTarget(note.id)} aria-label="Delete note">
                      <Trash2 size={13} />
                    </button>
                  </span>
                )}
              </div>

              {editingId === note.id ? (
                <div className={styles.editArea}>
                  <RichTextEditor value={editDraft} onChange={setEditDraft} />
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
                <RichTextViewer content={note.content} className={styles.entryContent} />
              )}
            </li>
          ))}
        </ul>
      )}

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
