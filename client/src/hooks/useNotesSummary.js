import { useEffect, useState } from 'react';
import { getPlainTextFromRichText } from '../components/RichTextViewer';
import { generateNotesSummary, updateNotesSummary } from '../api/notes';
import { fetchJiraConfig } from '../api/jira';
import { useToast } from '../contexts/ToastContext';

/**
 * Converts a plain multi-paragraph AI summary string into HTML paragraph nodes
 * so RichTextEditor's Tiptap parser preserves paragraph breaks instead of
 * collapsing them into one block. Real Tiptap JSON (from a prior manual edit)
 * passes through unchanged.
 */
function toEditableContent(value) {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    if (parsed && parsed.type === 'doc') return value;
  } catch {
    // not JSON — treat as plain text below
  }
  const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return value
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

/**
 * Shared AI-summary state/behaviour for a feature's internal notes log.
 * Used by both InternalNotesLog (inline panel) and NotesSummaryPanel
 * (standalone card) so summary generation/edit logic exists in one place.
 */
export function useNotesSummary({ featureId, initialSummary = null, notesCount = 0, newestNoteCreatedAt = null, enabled = true }) {
  const { addToast } = useToast();

  const [summary, setSummary] = useState(initialSummary);
  const [summarising, setSummarising] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const [isEditingSummary, setIsEditingSummary] = useState(false);
  const [summaryEditDraft, setSummaryEditDraft] = useState('');
  const [savingSummary, setSavingSummary] = useState(false);

  useEffect(() => {
    setSummary(initialSummary);
    setIsEditingSummary(false);
    setSummaryEditDraft('');
  }, [featureId, initialSummary]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetchJiraConfig()
      .then((cfg) => { if (!cancelled) setAiConfigured(!!cfg.aiConfigured); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);

  const isStale = summary && newestNoteCreatedAt && new Date(newestNoteCreatedAt) > new Date(summary.generatedAt);

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
    setSummaryEditDraft(toEditableContent(summary.content));
  };

  const cancelEditSummary = () => {
    setIsEditingSummary(false);
    setSummaryEditDraft('');
  };

  const handleSaveSummary = async () => {
    if (!getPlainTextFromRichText(summaryEditDraft)?.trim()) return;
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

  return {
    summary,
    summarising,
    aiConfigured: enabled && aiConfigured,
    isStale,
    canSummarise: notesCount > 0,
    isEditingSummary,
    summaryEditDraft,
    setSummaryEditDraft,
    savingSummary,
    handleSummarise,
    startEditSummary,
    cancelEditSummary,
    handleSaveSummary,
  };
}
