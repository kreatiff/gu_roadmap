import { Sparkles, Pencil, X, Check } from 'lucide-react';
import RichTextEditor from '../RichTextEditor';
import RichTextViewer from '../RichTextViewer';
import { useNotesSummary } from '../../hooks/useNotesSummary';
import InternalNotesLog from '../InternalNotesLog/InternalNotesLog';
import styles from './NotesSummaryPanel.module.css';

const formatTime = (isoString) => {
  return new Intl.DateTimeFormat('en-AU', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(new Date(isoString));
};

const NotesSummaryPanel = ({
  featureId,
  initialSummary = null,
  notesCount = 0,
  latestNoteActivityAt = null,
  notes,
  setNotes,
}) => {
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
  } = useNotesSummary({ featureId, initialSummary, notesCount, latestNoteActivityAt });

  if (!aiConfigured) return null;

  const isManual = summary?.source === 'manual';

  return (
    <div className={styles.summaryPanel}>
      <div className={styles.header}>
        <span className={styles.headerLabel}>Internal Notes Summary</span>
        <span className={styles.headerBadge}>{isManual ? 'Manually Written' : 'AI Generated'}</span>
      </div>
      {summary ? (
        <>
          <div className={styles.summaryMeta}>
            <span>{isManual ? 'Written' : 'Generated'} by {summary.generatedByName} on {formatTime(summary.generatedAt)}</span>
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

      <div className={styles.smallScreenNotesLog}>
        <InternalNotesLog
          featureId={featureId}
          notes={notes}
          setNotes={setNotes}
          showSummary={false}
          collapsible
        />
      </div>
    </div>
  );
};

export default NotesSummaryPanel;
