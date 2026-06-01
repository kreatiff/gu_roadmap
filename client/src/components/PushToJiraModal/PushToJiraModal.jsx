import { useState, useEffect, useRef } from 'react';
import { X, CheckCircle, Plus, ExternalLink, Check, AlertTriangle, Clipboard, Lightbulb, Zap } from 'lucide-react';
import {
  generateJiraPreview,
  fetchJiraEpics,
  fetchJiraLabels,
  pushToJira,
  saveJiraDraft,
  discardJiraDraft,
} from '../../api/jira';
import { useToast } from '../../contexts/ToastContext';
import ConfirmDialog from '../ConfirmDialog';
import { getPlainTextFromRichText } from '../RichTextViewer';
import styles from './PushToJiraModal.module.css';

/* ── helpers ──────────────────────────────────────────────────────────────── */

const PTS_OPTIONS = [0, 1, 2, 3, 5, 8, 13];
const PRIORITIES = ['Highest', 'High', 'Medium', 'Low', 'Lowest'];
const GRANULARITY_OPTIONS = [
  { value: 'high',     label: 'High-level' },
  { value: 'balanced', label: 'Balanced' },
  { value: 'detailed', label: 'Detailed' },
];
const EST_TASKS = { high: '3–5', balanced: '7–9', detailed: '10–15' };

const TIMELINE_MILESTONES = [
  'Understanding feature',
  'Planning epic structure',
  'Drafting epic description',
  'Identifying work areas',
  'Generating task descriptions',
  'Finalising',
];

const PRI_COLORS = {
  Highest: '#ef4444',
  High:    '#f97316',
  Medium:  '#eab308',
  Low:     '#3b82f6',
  Lowest:  '#94a3b8',
};

function formatDate(iso) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

function totalPts(tasks) {
  return tasks.reduce((s, t) => s + (Number(t.pts) || 0), 0);
}

const EpicIcon = () => <span className={styles.epicIcon}>E</span>;
const TaskIcon = () => <span className={styles.taskIcon}>T</span>;

/* ── Stepper ──────────────────────────────────────────────────────────────── */
const STEPS = ['Setup', 'Generate', 'Review', 'Done'];

function Stepper({ step }) {
  return (
    <div className={styles.stepper}>
      {STEPS.map((label, i) => {
        const n = i + 1;
        const isDone   = step > n;
        const isActive = step === n;
        return [
          <div
            key={`s${n}`}
            className={`${styles.stepItem}${isDone ? ' ' + styles.done : ''}${isActive ? ' ' + styles.active : ''}`}
          >
            <span className={styles.stepNum}>
              {isDone ? <Check size={11} strokeWidth={3} /> : n}
            </span>
            {label}
          </div>,
          i < STEPS.length - 1 && (
            <div key={`sep${n}`} className={`${styles.stepSep}${isDone ? ' ' + styles.done : ''}`} />
          ),
        ];
      })}
      <div className={styles.stepperSpacer} />
    </div>
  );
}

/* ── Toggle ──────────────────────────────────────────────────────────────── */
function Toggle({ on, onChange }) {
  return (
    <span className={styles.toggleWrap} onClick={() => onChange(!on)} role="switch" aria-checked={on}>
      <span className={`${styles.toggleTrack}${on ? ' ' + styles.on : ''}`} />
      <span className={`${styles.toggleThumb}${on ? ' ' + styles.on : ''}`} />
    </span>
  );
}

/* ── MarkdownPreview — mirrors buildADF, rendered as React elements ───────── */

/** Split text on inline markdown tokens, return mixed array of strings + elements. */
function renderInline(text, baseKey = 0) {
  const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_|`[^`]+`)/g;
  return text.split(regex).map((part, i) => {
    if (!part) return null;
    const k = `${baseKey}-${i}`;
    if (part.startsWith('***') && part.endsWith('***') && part.length > 6)
      return <strong key={k}><em>{part.slice(3, -3)}</em></strong>;
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4)
      return <strong key={k}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2)
      return <em key={k}>{part.slice(1, -1)}</em>;
    if (part.startsWith('_') && part.endsWith('_') && part.length > 2)
      return <em key={k}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return <code key={k} className={styles.mdCode}>{part.slice(1, -1)}</code>;
    return part;
  }).filter(Boolean);
}

function MarkdownPreview({ text }) {
  if (!text?.trim()) {
    return <div className={styles.mdEmpty}>No description yet.</div>;
  }

  const elements = [];
  const lines  = text.split('\n');
  let listItems = [];
  let listType  = null; // 'ul' | 'ol'
  let key = 0;

  const flushList = () => {
    if (!listItems.length) return;
    const Tag = listType === 'ol' ? 'ol' : 'ul';
    elements.push(
      <Tag key={key++} className={listType === 'ol' ? styles.mdOl : styles.mdUl}>
        {listItems.map((item, i) => (
          <li key={i} className={styles.mdLi}>{renderInline(item, key + i)}</li>
        ))}
      </Tag>
    );
    listItems = [];
    listType  = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { flushList(); continue; }

    // Horizontal rule
    if (line === '---' || line === '***' || line === '___') {
      flushList();
      elements.push(<hr key={key++} className={styles.mdHr} />);
      continue;
    }

    // Headings — cap at 4 visual levels
    const hm = line.match(/^(#{1,6})\s+(.*)$/);
    if (hm) {
      flushList();
      const level = Math.min(hm[1].length, 4);
      const cls = [styles.mdH1, styles.mdH2, styles.mdH3, styles.mdH4][level - 1];
      elements.push(<div key={key++} className={cls}>{renderInline(hm[2], key)}</div>);
      continue;
    }

    // Bullet list
    const bm = line.match(/^[-*•]\s+(.*)$/);
    if (bm) {
      if (listType !== 'ul') { flushList(); listType = 'ul'; }
      listItems.push(bm[1]);
      continue;
    }

    // Ordered list
    const om = line.match(/^\d+\.\s+(.+)$/);
    if (om) {
      if (listType !== 'ol') { flushList(); listType = 'ol'; }
      listItems.push(om[1]);
      continue;
    }

    // Paragraph — join consecutive non-structural lines
    flushList();
    let para = line;
    while (i + 1 < lines.length) {
      const next = lines[i + 1].trim();
      if (!next || next.match(/^(#{1,6})\s+/) || next.match(/^[-*•]\s+/) ||
          next.match(/^\d+\.\s+/) || next === '---') break;
      para += ' ' + next;
      i++;
    }
    elements.push(<p key={key++} className={styles.mdP}>{renderInline(para, key)}</p>);
  }

  flushList();
  return <div className={styles.mdPreview}>{elements}</div>;
}

/* ── LabelCombobox — shared by epic and task detail editors ──────────────── */

function LabelCombobox({ existingLabels = [], suggestions = [], onAdd }) {
  const [query,       setQuery]       = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const filtered = suggestions
    .filter(s => !existingLabels.includes(s) && s.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 10);

  const commit = (label) => {
    const trimmed = label.trim();
    if (trimmed && !existingLabels.includes(trimmed)) onAdd(trimmed);
    setQuery('');
    setShowDropdown(false);
  };

  return (
    <div className={styles.epicCombo}>
      <input
        className={styles.labelComboInput}
        value={query}
        onChange={e => { setQuery(e.target.value); setShowDropdown(true); }}
        onFocus={() => setShowDropdown(true)}
        onBlur={() => setTimeout(() => setShowDropdown(false), 160)}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(query); }
          if (e.key === 'Escape') { setQuery(''); setShowDropdown(false); }
        }}
        placeholder="Search or type a label…"
        autoComplete="off"
      />
      {showDropdown && (filtered.length > 0 || query.trim()) && (
        <div className={styles.labelComboDropdown}>
          {filtered.map(s => (
            <div key={s} className={styles.epicComboOption} onMouseDown={e => { e.preventDefault(); commit(s); }}>
              <span className={styles.epicComboSummary}>{s}</span>
            </div>
          ))}
          {query.trim() && !suggestions.includes(query.trim()) && (
            <div
              className={styles.epicComboOption}
              style={{ borderTop: filtered.length ? '1px solid var(--border-color)' : 'none', fontStyle: 'italic' }}
              onMouseDown={e => { e.preventDefault(); commit(query.trim()); }}
            >
              <span className={styles.epicComboSummary}>Add &ldquo;{query.trim()}&rdquo;</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  Main component                                                            */
/* ══════════════════════════════════════════════════════════════════════════ */

const PushToJiraModal = ({
  feature,
  featureId,
  jiraBaseUrl,
  initialDraft,
  onClose,
  onPushSuccess,
  onDraftChange,
}) => {
  const { addToast } = useToast();

  /* ── wizard step ── */
  const [step, setStep] = useState(1);

  /* ── step 1 config ── */
  const [jiraType,          setJiraType]          = useState('epic');
  const [granularity,       setGranularity]       = useState('balanced');
  const [defaultPts,        setDefaultPts]        = useState(3);
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(true);
  const [extraContext,      setExtraContext]       = useState('');
  const [generateChildTasks, setGenerateChildTasks] = useState(true);
  const [parentEpicKey,     setParentEpicKey]     = useState('');
  const [availableEpics,    setAvailableEpics]    = useState([]);
  const [epicsLoading,      setEpicsLoading]      = useState(false);
  const [epicQuery,         setEpicQuery]         = useState('');
  const [showEpicDropdown,  setShowEpicDropdown]  = useState(false);
  const epicComboRef = useRef(null);

  /* ── generated content ── */
  const [epicData,   setEpicData]   = useState({ summary: '', description: '', labels: [], priority: 'Medium' });
  const [childTasks, setChildTasks] = useState([]);

  /* ── step 3 state — -1 = epic selected, ≥0 = that task index ── */
  const [selectedTaskIdx, setSelectedTaskIdx] = useState(-1);

  /* ── step 3 resizable sidebar (percentage of container) ── */
  const [leftPct, setLeftPct]   = useState(30); // percent
  const leftPctRef  = useRef(30);
  const isResizing  = useRef(false);
  const contentRef  = useRef(null);

  /* ── streaming / generation ── */
  const [isLoading,      setIsLoading]      = useState(false);
  const [streamProgress, setStreamProgress] = useState(0);
  const [streamedCount,  setStreamedCount]  = useState(0);
  const progressTimer = useRef(null);
  const revealTimer   = useRef(null);

  /* ── push result ── */
  const [resultKeys, setResultKeys] = useState({ issueKey: '', childKeys: [] });
  const [isPushing,  setIsPushing]  = useState(false);

  /* ── labels from Jira ── */
  const [jiraLabels, setJiraLabels] = useState([]);

  /* ── draft ── */
  const [draftLoaded, setDraftLoaded] = useState(false);

  /* ── dialogs ── */
  const [backConfirm,  setBackConfirm]  = useState(false);
  const [closeConfirm, setCloseConfirm] = useState(false);

  /* ── description edit/preview toggle ── */
  const [descPreview, setDescPreview] = useState(false);

  /* ── mount ── */
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    if (initialDraft?.epicData) setDraftLoaded(true);
    fetchJiraLabels()
      .then(res => setJiraLabels(res?.labels || []))
      .catch(() => {}); // non-critical — fall back to free-text
    return () => {
      document.body.style.overflow = 'unset';
      clearInterval(progressTimer.current);
      clearInterval(revealTimer.current);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── reset description preview when switching between epic / task editors ── */
  useEffect(() => { setDescPreview(false); }, [selectedTaskIdx]);

  /* ── fetch epics when switching to task type ── */
  useEffect(() => {
    if (jiraType !== 'task') return;
    setEpicsLoading(true);
    fetchJiraEpics()
      .then(epics => {
        setAvailableEpics(epics || []);
        if (epics?.length > 0 && !parentEpicKey) {
          setParentEpicKey(epics[0].key);
          setEpicQuery(`[${epics[0].key}] ${epics[0].summary}`);
        }
      })
      .catch(() => addToast('Failed to fetch Jira epics.', 'error'))
      .finally(() => setEpicsLoading(false));
  }, [jiraType]); // eslint-disable-line react-hooks/exhaustive-deps

  /* ── draft helpers ── */
  const handleResumeDraft = () => {
    const d = initialDraft;
    if (d.config) {
      if (d.config.jiraType)           setJiraType(d.config.jiraType);
      if (d.config.granularity)        setGranularity(d.config.granularity);
      if (d.config.defaultPts != null) setDefaultPts(d.config.defaultPts);
      if (d.config.acceptanceCriteria != null) setAcceptanceCriteria(d.config.acceptanceCriteria);
      if (d.config.extraContext)       setExtraContext(d.config.extraContext);
    }
    setEpicData(d.epicData || { summary: '', description: '', labels: [], priority: 'Medium' });
    setChildTasks(d.childTasks || []);
    setSelectedTaskIdx(-1);
    setDraftLoaded(false);
    setStep(3);
  };

  const handleDiscardDraft = () => {
    discardJiraDraft(featureId).catch(() => {});
    if (onDraftChange) onDraftChange(null);
    setDraftLoaded(false);
  };

  /* ── auto-save after generation completes ── */
  const persistDraft = async (epicD, tasks, cfg) => {
    try {
      const saved = await saveJiraDraft({ featureId, epicData: epicD, childTasks: tasks, config: cfg });
      if (onDraftChange) onDraftChange({ featureId, epicData: epicD, childTasks: tasks, config: cfg, updatedAt: saved?.savedAt });
    } catch {
      addToast('Draft could not be saved. Your changes are still here.', 'warning');
    }
  };

  /* ── generate ── */
  const handleGenerate = async () => {
    setStep(2);
    setIsLoading(true);
    setStreamProgress(0);
    setStreamedCount(0);

    // Animated progress (capped at 88% until API responds)
    progressTimer.current = setInterval(() => {
      setStreamProgress(p => (p < 88 ? p + 1.5 : p));
    }, 100);

    try {
      const result = await generateJiraPreview({
        featureId,
        jiraType,
        generateChildTasks: jiraType === 'epic' ? generateChildTasks : false,
        granularity,
        extraContext,
        acceptanceCriteria,
      });

      clearInterval(progressTimer.current);
      setStreamProgress(100);

      const epic  = result.epic  || {};
      const tasks = (result.childTasks || []).map(t => ({ ...t, pts: defaultPts, priority: 'Medium', labels: [] }));

      setEpicData({
        summary:     epic.summary     || feature?.title || '',
        description: epic.description || '',
        labels:      epic.labels      || [],
        priority:    epic.priority    || 'Medium',
      });
      setChildTasks(tasks);
      setIsLoading(false);

      // Reveal tasks one-by-one
      let count = 0;
      revealTimer.current = setInterval(() => {
        count += 1;
        setStreamedCount(count);
        if (count >= tasks.length) {
          clearInterval(revealTimer.current);
          // Auto-save draft and advance
          const cfg = { jiraType, granularity, extraContext, acceptanceCriteria, defaultPts };
          persistDraft(
            { summary: epic.summary || feature?.title || '', description: epic.description || '', labels: epic.labels || [], priority: epic.priority || 'Medium' },
            tasks,
            cfg
          );
          setSelectedTaskIdx(-1);
          setStep(3);
        }
      }, 300);

    } catch (err) {
      clearInterval(progressTimer.current);
      setIsLoading(false);
      setStreamProgress(0);
      addToast(err?.error || 'Failed to generate Jira preview.', 'error');
      setStep(1);
    }
  };

  const handleStopDiscard = () => {
    clearInterval(progressTimer.current);
    clearInterval(revealTimer.current);
    discardJiraDraft(featureId).catch(() => {});
    if (onDraftChange) onDraftChange(null);
    setIsLoading(false);
    setStreamProgress(0);
    setStreamedCount(0);
    setStep(1);
  };

  const handleKeepPartial = () => {
    clearInterval(progressTimer.current);
    clearInterval(revealTimer.current);
    const partial = childTasks.slice(0, streamedCount);
    setChildTasks(partial);
    const cfg = { jiraType, granularity, extraContext, acceptanceCriteria, defaultPts };
    persistDraft(epicData, partial, cfg);
    setSelectedTaskIdx(-1);
    setStep(3);
  };

  /* ── push ── */
  const handlePush = async () => {
    setIsPushing(true);
    try {
      const payload = {
        featureId,
        jiraType,
        parentEpicKey: jiraType === 'task' ? parentEpicKey : undefined,
        epic: epicData,
        childTasks,
      };
      const res = await pushToJira(payload);
      setResultKeys(res);
      setStep(4);
      if (onPushSuccess) onPushSuccess(res.issueKey, res.childKeys);
    } catch (err) {
      addToast(err?.error || 'Failed to push to Jira.', 'error');
    } finally {
      setIsPushing(false);
    }
  };

  /* ── save for later ── */
  const handleSaveForLater = async () => {
    const cfg = { jiraType, granularity, extraContext, acceptanceCriteria, defaultPts };
    await persistDraft(epicData, childTasks, cfg);
    addToast('Draft saved. You can resume anytime.', 'success');
    onClose();
  };

  /* ── close guard ── */
  const handleClose = () => {
    if (step === 3 && childTasks.length > 0) {
      setCloseConfirm(true);
    } else if (step === 2) {
      // During generation: always confirm. After generation completes: confirm with draft notice.
      setCloseConfirm(true);
    } else {
      onClose();
    }
  };

  /* ── task list helpers ── */
  const updateTask = (idx, field, value) => {
    setChildTasks(prev => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const removeTask = (idx) => {
    setChildTasks(prev => {
      const next = prev.filter((_, i) => i !== idx);
      setSelectedTaskIdx(prevIdx => {
        if (prevIdx === -1) return -1;              // epic stays selected
        if (prevIdx < idx) return prevIdx;          // earlier task unaffected
        if (prevIdx > idx) return prevIdx - 1;      // later task shifts down
        return next.length > 0 ? Math.max(0, idx - 1) : -1; // removed task → neighbour or epic
      });
      return next;
    });
  };

  const addTask = () => {
    const newTask = { summary: '', description: '', pts: defaultPts, priority: 'Medium', labels: [] };
    setChildTasks(prev => {
      const next = [...prev, newTask];
      setSelectedTaskIdx(next.length - 1);
      return next;
    });
  };


  const selectedTask = selectedTaskIdx >= 0 ? (childTasks[selectedTaskIdx] || null) : null;

  /* ── resize handler ── */
  const startResize = (e) => {
    e.preventDefault();
    isResizing.current = true;
    const startX       = e.clientX;
    const startPct     = leftPctRef.current;
    const containerW   = contentRef.current?.offsetWidth || window.innerWidth;

    document.body.style.cursor     = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMouseMove = (ev) => {
      if (!isResizing.current) return;
      const deltaPct = ((ev.clientX - startX) / containerW) * 100;
      const next = Math.min(55, Math.max(15, startPct + deltaPct));
      leftPctRef.current = next;
      setLeftPct(next);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  /* ── content grid class ── */
  const contentClass = [
    styles.content,
    step === 2 ? styles.step2Layout : '',
    step === 4 ? styles.step4Layout : '',
  ].filter(Boolean).join(' ');

  /* ── timeline milestone state ── */
  const milestoneForProgress = (p) => Math.floor((p / 100) * TIMELINE_MILESTONES.length);

  /* ════════════════════════════════════════════════════════════════════════ */
  /*  RENDER                                                                  */
  /* ════════════════════════════════════════════════════════════════════════ */

  return (
    <div className={styles.takeover}>
      <div className={styles.scrim} />
      <div className={styles.window}>

        {/* ── Top bar ── */}
        <div className={styles.topbar}>
          <div className={styles.topbarTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
              <path fill="#1868db" d="M0 6a6 6 0 0 1 6-6h12a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6z"/>
              <path fill="white" d="M9.051 15.434H7.734c-1.988 0-3.413-1.218-3.413-3h7.085c.367 0 .605.26.605.63v7.13c-1.772 0-2.96-1.435-2.96-3.434zm3.5-3.543h-1.318c-1.987 0-3.413-1.196-3.413-2.978h7.085c.367 0 .627.239.627.608v7.13c-1.772 0-2.981-1.435-2.981-3.434zm3.52-3.522h-1.317c-1.987 0-3.413-1.217-3.413-3h7.085c.367 0 .605.262.605.61v7.129c-1.771 0-2.96-1.435-2.96-3.434z"/>
            </svg>
            Push to Jira
          </div>
          <div className={styles.topbarDivider} />
          <span className={styles.breadcrumb}>{feature?.title || 'Feature'}</span>
          <div className={styles.topbarSpacer} />
          <button className={styles.closeBtn} onClick={handleClose} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* ── Stepper ── */}
        <Stepper step={step} />

        {/* ── Content ── */}
        <div
          ref={contentRef}
          className={contentClass}
          style={step === 3 ? { gridTemplateColumns: `${leftPct}% 4px 1fr` } : undefined}
        >

          {/* ════════ STEP 1: SETUP ════════ */}
          {step === 1 && (
            <>
              <div className={styles.leftPane}>
                {/* Draft resume banner */}
                {draftLoaded && (
                  <div className={styles.draftBanner}>
                    <span className={styles.draftBannerText}>
                      <Clipboard size={14} /> Saved draft from {formatDate(initialDraft?.updatedAt)}
                    </span>
                    <button className={`${styles.btn} ${styles.btnSm}`} onClick={handleResumeDraft}>
                      Resume draft
                    </button>
                    <button className={`${styles.btn} ${styles.btnSm} ${styles.btnGhost}`} onClick={handleDiscardDraft}>
                      Discard
                    </button>
                  </div>
                )}

                {/* Feature card */}
                <div className={styles.featureCard}>
                  <div>
                    <div className={styles.featureCardTitle}>{feature?.title || 'Untitled feature'}</div>
                    <div className={styles.featureCardMeta}>Feature · {feature?.category || 'No category'}</div>
                  </div>
                </div>

                {/* Issue type selector */}
                <span className={styles.sectionLabel}>Issue type</span>
                <div className={styles.typeCardGrid}>
                  <button
                    className={`${styles.typeCard}${jiraType === 'epic' ? ' ' + styles.selected : ''}`}
                    onClick={() => setJiraType('epic')}
                  >
                    <div className={styles.typeCardHeader}>
                      <EpicIcon />
                      <span className={styles.typeCardName}>Epic</span>
                      {jiraType === 'epic' && <Check size={14} className={styles.selectedCheck} />}
                    </div>
                    <div className={styles.typeCardSub}>Top-level initiative with child tasks</div>
                  </button>
                  <button
                    className={`${styles.typeCard}${jiraType === 'task' ? ' ' + styles.selected : ''}`}
                    onClick={() => setJiraType('task')}
                  >
                    <div className={styles.typeCardHeader}>
                      <TaskIcon />
                      <span className={styles.typeCardName}>Task</span>
                      {jiraType === 'task' && <Check size={14} className={styles.selectedCheck} />}
                    </div>
                    <div className={styles.typeCardSub}>Standalone work item under an epic</div>
                  </button>
                </div>

                {/* Epic: AI Foundry options */}
                {jiraType === 'epic' && (
                  <div className={styles.aiSection}>
                    <div className={styles.aiSectionHeader}>
                      <div style={{ flex: 1 }}>
                        <div className={styles.aiSectionTitle}>AI Foundry: Generate child tasks</div>
                        <div className={styles.aiSectionSub}>Azure OpenAI will break the epic into implementation tasks</div>
                      </div>
                      <Toggle on={generateChildTasks} onChange={setGenerateChildTasks} />
                    </div>

                    {generateChildTasks && (
                      <>
                        <span className={styles.sectionLabel}>Granularity</span>
                        <div className={styles.segmented}>
                          {GRANULARITY_OPTIONS.map(opt => (
                            <button
                              key={opt.value}
                              className={`${styles.segmentedBtn}${granularity === opt.value ? ' ' + styles.active : ''}`}
                              onClick={() => setGranularity(opt.value)}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        <span className={styles.sectionLabel}>Default story points</span>
                        <div className={styles.ptsGrid} style={{ marginBottom: 14 }}>
                          {PTS_OPTIONS.map(p => (
                            <button
                              key={p}
                              className={`${styles.ptsBtn}${defaultPts === p ? ' ' + styles.selected : ''}`}
                              onClick={() => setDefaultPts(p)}
                            >
                              {p}
                            </button>
                          ))}
                        </div>

                        <label className={styles.checkRow}>
                          <input
                            type="checkbox"
                            checked={acceptanceCriteria}
                            onChange={e => setAcceptanceCriteria(e.target.checked)}
                          />
                          Include acceptance criteria per task
                        </label>

                        <div style={{ marginTop: 14 }}>
                          <span className={styles.sectionLabel}>Extra context for AI <span style={{ textTransform: 'none', fontWeight: 400, opacity: 0.7 }}>(optional)</span></span>
                          <textarea
                            className={styles.textarea}
                            style={{ minHeight: 72 }}
                            placeholder="E.g. focus on backend only, use React 19 hooks, target mobile first…"
                            value={extraContext}
                            onChange={e => setExtraContext(e.target.value)}
                          />
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Task: parent epic picker */}
                {jiraType === 'task' && (
                  <div style={{ marginTop: 4 }}>
                    <span className={styles.sectionLabel}>Parent epic</span>
                    {epicsLoading ? (
                      <div className={styles.placeholderField}>Loading epics…</div>
                    ) : (
                      <div className={styles.epicCombo} ref={epicComboRef}>
                        <input
                          className={styles.epicComboInput}
                          type="text"
                          placeholder="Search epics by key or title…"
                          value={epicQuery}
                          onChange={e => {
                            setEpicQuery(e.target.value);
                            setShowEpicDropdown(true);
                            // Clear the committed key if user is typing freely
                            setParentEpicKey('');
                          }}
                          onFocus={() => setShowEpicDropdown(true)}
                          onBlur={() => {
                            // Delay so click on option registers first
                            setTimeout(() => {
                              setShowEpicDropdown(false);
                              // If nothing committed, restore last valid label or clear
                              if (!parentEpicKey) {
                                const match = availableEpics.find(
                                  e => epicQuery.toLowerCase().includes(e.key.toLowerCase())
                                );
                                if (match) {
                                  setParentEpicKey(match.key);
                                  setEpicQuery(`[${match.key}] ${match.summary}`);
                                } else {
                                  setEpicQuery('');
                                }
                              }
                            }, 160);
                          }}
                          onKeyDown={e => {
                            if (e.key === 'Escape') setShowEpicDropdown(false);
                          }}
                          autoComplete="off"
                        />
                        {showEpicDropdown && (() => {
                          const q = epicQuery.toLowerCase();
                          const filtered = availableEpics.filter(
                            e => e.key.toLowerCase().includes(q) || e.summary.toLowerCase().includes(q)
                          );
                          return filtered.length > 0 ? (
                            <div className={styles.epicComboDropdown}>
                              {filtered.map(epic => (
                                <div
                                  key={epic.key}
                                  className={`${styles.epicComboOption}${parentEpicKey === epic.key ? ' ' + styles.epicComboOptionSelected : ''}`}
                                  onMouseDown={e => {
                                    e.preventDefault();
                                    setParentEpicKey(epic.key);
                                    setEpicQuery(`[${epic.key}] ${epic.summary}`);
                                    setShowEpicDropdown(false);
                                  }}
                                >
                                  <span className={styles.epicComboKey}>{epic.key}</span>
                                  <span className={styles.epicComboSummary}>{epic.summary}</span>
                                  {parentEpicKey === epic.key && <Check size={13} style={{ color: '#10b981', flexShrink: 0 }} />}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className={styles.epicComboDropdown}>
                              <div className={styles.epicComboEmpty}>No epics match your search</div>
                            </div>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Right pane: preview */}
              <div className={styles.rightPane}>
                <span className={styles.sectionLabel}>Feature summary</span>
                <div className={styles.previewCard}>
                  <div className={styles.previewTitle}>{feature?.title || 'Untitled'}</div>
                  {feature?.description && (() => {
                    const plain = getPlainTextFromRichText(feature.description);
                    return plain ? <div className={styles.previewText}>{plain}</div> : null;
                  })()}
                </div>

                <span className={styles.sectionLabel}>Jira items to be created</span>
                <div className={styles.issueTree}>
                  <div className={styles.epicRow}>
                    <EpicIcon />
                    <div style={{ flex: 1 }}>
                      <div className={styles.epicRowTitle}>1 Epic (AI-drafted)</div>
                      <div className={styles.epicRowSub}>Summary, description &amp; labels generated by AI</div>
                    </div>
                    <span className={`${styles.badge} ${styles.purple}`}>Epic</span>
                  </div>

                  {jiraType === 'epic' && generateChildTasks && (
                    <div className={styles.treeConnector}>
                      <div className={styles.treeLine} />
                      <div className={styles.taskPreviewRow}>
                        <div className={styles.taskPreviewHeader}>
                          <TaskIcon />
                          <div className={styles.taskPreviewTitle}>
                            ~{EST_TASKS[granularity]} child Tasks (AI-generated)
                          </div>
                        </div>
                        <div className={styles.taskBullet}>
                          <Check size={12} style={{ color: '#10b981', flexShrink: 0 }} />
                          Acceptance criteria {acceptanceCriteria ? 'included' : 'omitted'}
                        </div>
                        <div className={styles.taskBullet}>
                          <Check size={12} style={{ color: '#10b981', flexShrink: 0 }} />
                          Default {defaultPts} story points per task
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className={styles.statsRow}>
                  <div className={styles.statCard}>
                    <div className={styles.statValue}>{jiraType === 'epic' && generateChildTasks ? `~${EST_TASKS[granularity]}` : '1'}</div>
                    <div className={styles.statLabel}>Est. tasks</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statValue}>{granularity === 'high' ? '~15' : granularity === 'balanced' ? '~28' : '~45'}</div>
                    <div className={styles.statLabel}>Est. points</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statValue}>AI</div>
                    <div className={styles.statLabel}>Drafted by</div>
                  </div>
                </div>

                <div className={styles.warningNotice}>
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} />
                  AI-generated content may need review. You'll be able to edit everything before pushing.
                </div>
              </div>
            </>
          )}

          {/* ════════ STEP 2: GENERATE ════════ */}
          {step === 2 && (
            <>
              <div className={styles.leftPane}>
                <div className={styles.progressWrap}>
                  <div className={styles.progressHeader}>
                    <div>
                      <div className={styles.progressHeading}>
                        {isLoading ? 'Generating with AI Foundry…' : 'Generation complete'}
                      </div>
                      <div className={styles.progressSub}>Azure OpenAI · {feature?.title}</div>
                    </div>
                  </div>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${streamProgress}%` }} />
                  </div>
                  <div className={styles.progressStats}>
                    <span>{Math.round(streamProgress)}%</span>
                    <span>{isLoading ? 'In progress…' : 'Done'}</span>
                  </div>
                </div>

                {/* Timeline */}
                <div className={styles.timeline}>
                  <div className={styles.timelineLine} />
                  {TIMELINE_MILESTONES.map((label, i) => {
                    const activeMilestone = milestoneForProgress(streamProgress);
                    const isDone   = i < activeMilestone;
                    const isActive = i === activeMilestone && isLoading;
                    return (
                      <div key={i} className={styles.timelineItem}>
                        <div className={`${styles.timelineDot}${isDone ? ' ' + styles.done : isActive ? ' ' + styles.active : ' ' + styles.pending}`} />
                        <div>
                          <div className={`${styles.timelineLabel}${(!isDone && !isActive) ? ' ' + styles.pending : ''}${isActive ? ' ' + styles.active : ''}`}>
                            {label}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className={styles.keepWorkingTip}>
                  <Lightbulb size={14} /> Generation typically takes 10–20 seconds. You can review and edit everything before pushing.
                </div>
              </div>

              {/* Right pane: streaming cards */}
              <div className={styles.rightPane}>
                {/* Epic draft card */}
                <div className={styles.epicDraftCard}>
                  <div className={styles.epicDraftHeader}>
                    <EpicIcon />
                    <span className={styles.epicDraftLabel}>Epic Draft</span>
                    {!isLoading && <span className={`${styles.badge} ${styles.green}`}>Ready</span>}
                  </div>
                  {isLoading && !epicData.summary ? (
                    <>
                      <div className={`${styles.skel}`} style={{ height: 18, width: '70%', marginBottom: 8 }} />
                      <div className={`${styles.skel}`} style={{ height: 12, width: '100%', marginBottom: 6 }} />
                      <div className={`${styles.skel}`} style={{ height: 12, width: '85%' }} />
                    </>
                  ) : (
                    <>
                      <div className={styles.epicDraftTitle}>{epicData.summary}</div>
                      <div className={styles.epicDraftDesc}>{epicData.description?.slice(0, 200)}{epicData.description?.length > 200 ? '…' : ''}</div>
                    </>
                  )}
                </div>

                {/* Task cards */}
                {generateChildTasks && (
                  <>
                    <div className={styles.taskCardsDivider}>
                      Child Tasks · {streamedCount} of {childTasks.length} revealed
                    </div>
                    {childTasks.map((task, idx) => {
                      const revealed  = idx < streamedCount;
                      const streaming = idx === streamedCount;
                      const pending   = idx > streamedCount;
                      return (
                        <div
                          key={idx}
                          className={`${styles.taskStreamCard}${streaming ? ' ' + styles.streaming : ''}${pending ? ' ' + styles.skeleton : ''}`}
                        >
                          <div className={styles.taskStreamIcon}>
                            <TaskIcon />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {revealed ? (
                              <>
                                <div className={styles.taskStreamTitle}>{task.summary}</div>
                                <div className={styles.taskStreamDesc}>{task.description}</div>
                              </>
                            ) : streaming ? (
                              <>
                                <div className={`${styles.skel}`} style={{ height: 14, width: '60%', marginBottom: 6 }} />
                                <div className={`${styles.skel}`} style={{ height: 11, width: '90%' }} />
                              </>
                            ) : (
                              <>
                                <div className={`${styles.skel}`} style={{ height: 14, width: '50%', marginBottom: 6 }} />
                                <div className={`${styles.skel}`} style={{ height: 11, width: '80%' }} />
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            </>
          )}

          {/* ════════ STEP 3: REVIEW ════════ */}
          {step === 3 && (
            <>
              {/* Master list (left pane) */}
              <div className={styles.leftPane} style={{ padding: 0 }}>
                <div className={styles.masterPaneInner}>

                  {/* Epic row — selectable */}
                  <div
                    className={`${styles.epicMasterRow}${selectedTaskIdx === -1 ? ' ' + styles.selected : ''}`}
                    onClick={() => { setSelectedTaskIdx(-1); }}
                  >
                    <EpicIcon />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className={styles.epicHeaderTitle} style={{ fontSize: '0.8125rem' }}>
                        {epicData.summary || 'Untitled epic'}
                      </div>
                      <div className={styles.epicHeaderMeta} style={{ marginTop: 3 }}>
                        <span className={`${styles.badge} ${styles.purple}`}>Epic</span>
                        <span className={`${styles.badge}`} style={{ background: PRI_COLORS[epicData.priority] + '20', color: PRI_COLORS[epicData.priority] }}>
                          {epicData.priority}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Task list toolbar */}
                  <div className={styles.taskListToolbar}>
                    <span className={styles.taskListToolbarTitle}>{childTasks.length} Tasks</span>
                    <div style={{ flex: 1 }} />
                    <button className={`${styles.btn} ${styles.btnXs}`} onClick={addTask}>
                      <Plus size={11} /> Add
                    </button>
                  </div>

                  {/* Task rows */}
                  <div className={styles.taskList}>
                    {childTasks.map((task, idx) => (
                      <div
                        key={idx}
                        className={`${styles.taskRow}${selectedTaskIdx === idx ? ' ' + styles.selected : ''}`}
                        onClick={() => { setSelectedTaskIdx(idx); }}
                      >
                        <TaskIcon />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className={`${styles.taskRowTitle}${selectedTaskIdx === idx ? ' ' + styles.selected : ''}`}>
                            {task.summary || <span style={{ color: 'var(--text-muted)' }}>Untitled task</span>}
                          </div>
                          <div className={styles.taskRowMeta}>
                            <span className={styles.badge}>{task.pts ?? defaultPts} pts</span>
                            <span style={{ width: 7, height: 7, borderRadius: '50%', background: PRI_COLORS[task.priority] || '#94a3b8', display: 'inline-block' }} />
                          </div>
                        </div>
                        <button
                          className={styles.taskRowRemove}
                          onClick={e => { e.stopPropagation(); removeTask(idx); }}
                          title="Remove task"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className={styles.masterFooter}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Total: {totalPts(childTasks)} pts
                    </span>
                  </div>
                </div>
              </div>

              {/* Resize handle */}
              <div className={styles.resizeHandle} onMouseDown={startResize} />

              {/* Detail pane (right) — epic editor or task editor */}
              <div className={styles.rightPane} style={{ padding: 0 }}>
                {selectedTaskIdx === -1 ? (
                  /* ── Epic editor ── */
                  <div className={styles.detailPane}>
                    <div className={styles.detailToolbar}>
                      <EpicIcon />
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Epic</span>
                      <span className={`${styles.badge} ${styles.purple}`} style={{ marginLeft: 4 }}>AI-drafted</span>
                    </div>
                    <div className={styles.detailContent}>
                      <div className={styles.detailField}>
                        <span className={styles.sectionLabel}>Summary</span>
                        <input
                          className={styles.inputLg}
                          value={epicData.summary}
                          onChange={e => setEpicData(prev => ({ ...prev, summary: e.target.value }))}
                          placeholder="Epic summary…"
                        />
                      </div>
                      <div className={styles.detailField}>
                        <div className={styles.fieldLabelRow}>
                          <span className={styles.sectionLabel}>Description</span>
                          <div className={styles.descModeToggle}>
                            <button
                              className={`${styles.descModeBtn}${!descPreview ? ' ' + styles.active : ''}`}
                              onClick={() => setDescPreview(false)}
                            >Edit</button>
                            <button
                              className={`${styles.descModeBtn}${descPreview ? ' ' + styles.active : ''}`}
                              onClick={() => setDescPreview(true)}
                            >Preview</button>
                          </div>
                        </div>
                        {descPreview ? (
                          <div className={styles.descPreviewBox}>
                            <MarkdownPreview text={epicData.description} />
                          </div>
                        ) : (
                          <textarea
                            className={styles.textarea}
                            value={epicData.description}
                            onChange={e => setEpicData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Epic description… (## headings, **bold**, - bullets)"
                            style={{ minHeight: 160 }}
                          />
                        )}
                      </div>
                      <div className={styles.metaRowTwoCols}>
                        <div>
                          <span className={styles.sectionLabel}>Priority</span>
                          <select
                            className={styles.selectField}
                            value={epicData.priority || 'Medium'}
                            onChange={e => setEpicData(prev => ({ ...prev, priority: e.target.value }))}
                          >
                            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div>
                          <span className={styles.sectionLabel}>Assignee</span>
                          <div className={styles.placeholderField}>Auto-assigned (future)</div>
                        </div>
                      </div>
                      <div className={styles.detailField}>
                        <span className={styles.sectionLabel}>Labels</span>
                        <div className={styles.labelsWrap}>
                          {(epicData.labels || []).map(lbl => (
                            <span key={lbl} className={styles.labelChip}>
                              {lbl}
                              <button
                                className={styles.labelChipRemove}
                                onClick={() => setEpicData(prev => ({ ...prev, labels: prev.labels.filter(l => l !== lbl) }))}
                              ><X size={10} /></button>
                            </span>
                          ))}
                          <LabelCombobox
                            existingLabels={epicData.labels || []}
                            suggestions={jiraLabels}
                            onAdd={lbl => setEpicData(prev => ({ ...prev, labels: [...(prev.labels || []), lbl] }))}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : selectedTask ? (
                  /* ── Task editor ── */
                  <div className={styles.detailPane}>
                    <div className={styles.detailToolbar}>
                      <TaskIcon />
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                        Task {selectedTaskIdx + 1} of {childTasks.length}
                      </span>
                    </div>
                    <div className={styles.detailContent}>
                      <div className={styles.detailField}>
                        <span className={styles.sectionLabel}>Summary</span>
                        <input
                          className={styles.inputLg}
                          value={selectedTask.summary}
                          onChange={e => updateTask(selectedTaskIdx, 'summary', e.target.value)}
                          placeholder="Task summary…"
                        />
                      </div>
                      <div className={styles.detailField}>
                        <div className={styles.fieldLabelRow}>
                          <span className={styles.sectionLabel}>Description</span>
                          <div className={styles.descModeToggle}>
                            <button
                              className={`${styles.descModeBtn}${!descPreview ? ' ' + styles.active : ''}`}
                              onClick={() => setDescPreview(false)}
                            >Edit</button>
                            <button
                              className={`${styles.descModeBtn}${descPreview ? ' ' + styles.active : ''}`}
                              onClick={() => setDescPreview(true)}
                            >Preview</button>
                          </div>
                        </div>
                        {descPreview ? (
                          <div className={styles.descPreviewBox}>
                            <MarkdownPreview text={selectedTask.description} />
                          </div>
                        ) : (
                          <textarea
                            className={styles.textarea}
                            value={selectedTask.description}
                            onChange={e => updateTask(selectedTaskIdx, 'description', e.target.value)}
                            placeholder="What needs to be done… (## headings, **bold**, - bullets)"
                          />
                        )}
                      </div>
                      <div className={styles.metaRow}>
                        <div>
                          <span className={styles.sectionLabel}>Story points</span>
                          <div className={styles.ptsGrid}>
                            {PTS_OPTIONS.map(p => (
                              <button
                                key={p}
                                className={`${styles.ptsBtn}${(selectedTask.pts ?? defaultPts) === p ? ' ' + styles.selected : ''}`}
                                onClick={() => updateTask(selectedTaskIdx, 'pts', p)}
                              >
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className={styles.sectionLabel}>Priority</span>
                          <select
                            className={styles.selectField}
                            value={selectedTask.priority || 'Medium'}
                            onChange={e => updateTask(selectedTaskIdx, 'priority', e.target.value)}
                          >
                            {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                          </select>
                        </div>
                        <div>
                          <span className={styles.sectionLabel}>Assignee</span>
                          <div className={styles.placeholderField}>Auto-assigned (future)</div>
                        </div>
                      </div>
                      <div className={styles.detailField}>
                        <span className={styles.sectionLabel}>Labels</span>
                        <div className={styles.labelsWrap}>
                          {(selectedTask.labels || []).map(lbl => (
                            <span key={lbl} className={styles.labelChip}>
                              {lbl}
                              <button
                                className={styles.labelChipRemove}
                                onClick={() => updateTask(selectedTaskIdx, 'labels', (selectedTask.labels || []).filter(l => l !== lbl))}
                              ><X size={10} /></button>
                            </span>
                          ))}
                          <LabelCombobox
                            existingLabels={selectedTask.labels || []}
                            suggestions={jiraLabels}
                            onAdd={lbl => updateTask(selectedTaskIdx, 'labels', [...(selectedTask.labels || []), lbl])}
                          />
                        </div>
                      </div>
                      <div className={styles.detailField}>
                        <span className={styles.sectionLabel}>Sprint</span>
                        <div className={styles.placeholderField}>Sprint assignment (future)</div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          )}

          {/* ════════ STEP 4: SUCCESS ════════ */}
          {step === 4 && (
            <>
              {/* Left pane: receipt */}
              <div className={styles.leftPane}>
                <div className={styles.successHero}>
                  <div className={styles.successIconWrap}>
                    <CheckCircle size={28} color="#16a34a" strokeWidth={2.5} />
                  </div>
                  <div className={styles.successHeading}>Pushed to Jira</div>
                  <div className={styles.successSub}>
                    {childTasks.length > 0
                      ? `1 Epic and ${resultKeys.childKeys?.length || 0} tasks are now live in your Jira project.`
                      : 'Your Jira issue is now live.'}
                  </div>
                </div>

                <div className={styles.receiptCard}>
                  <div className={styles.receiptRow}>
                    <span className={styles.receiptLabel}>Feature</span>
                    <span className={styles.receiptValue}>{feature?.title}</span>
                  </div>
                  <div className={styles.receiptRow}>
                    <span className={styles.receiptLabel}>Epic key</span>
                    <a
                      className={`${styles.receiptValue} ${styles.key}`}
                      href={jiraBaseUrl ? `${jiraBaseUrl.replace(/\/$/, '')}/browse/${resultKeys.issueKey}` : '#'}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {resultKeys.issueKey} <ExternalLink size={11} style={{ verticalAlign: 'middle' }} />
                    </a>
                  </div>
                  <div className={styles.receiptRow}>
                    <span className={styles.receiptLabel}>Tasks created</span>
                    <span className={styles.receiptValue}>{resultKeys.childKeys?.length || 0}</span>
                  </div>
                  <div className={styles.receiptRow}>
                    <span className={styles.receiptLabel}>Total points</span>
                    <span className={styles.receiptValue}>{totalPts(childTasks)}</span>
                  </div>
                  <div className={styles.receiptRow}>
                    <span className={styles.receiptLabel}>Live sync</span>
                    <span className={`${styles.receiptValue}`} style={{ color: '#16a34a' }}>Enabled</span>
                  </div>
                </div>

                <div className={styles.whatsNext}>
                  <div className={styles.whatsNextTitle}>What's next</div>
                  <a
                    className={`${styles.btn} ${styles.btnSm}`}
                    href={jiraBaseUrl ? `${jiraBaseUrl.replace(/\/$/, '')}/browse/${resultKeys.issueKey}` : '#'}
                    target="_blank"
                    rel="noreferrer"
                    style={{ textDecoration: 'none' }}
                  >
                    <ExternalLink size={13} /> Open epic in Jira
                  </a>
                </div>
              </div>

              {/* Right pane: issues list */}
              <div className={styles.rightPane} style={{ padding: 0 }}>
                <div className={styles.issueListHeader}>
                  <EpicIcon />
                  <span className={styles.issueListTitle}>Created issues</span>
                  <span className={`${styles.badge} ${styles.green}`}>{1 + (resultKeys.childKeys?.length || 0)} live</span>
                </div>
                <div className={styles.issueListBody}>
                  {/* Epic row */}
                  <div className={`${styles.issueRow} ${styles.epicRow}`}>
                    <EpicIcon />
                    <span className={styles.issueKey}>{resultKeys.issueKey}</span>
                    <span className={`${styles.issueTitle} ${styles.epic}`}>{epicData.summary}</span>
                    <a
                      href={jiraBaseUrl ? `${jiraBaseUrl.replace(/\/$/, '')}/browse/${resultKeys.issueKey}` : '#'}
                      target="_blank"
                      rel="noreferrer"
                      className={`${styles.btn} ${styles.btnXs} ${styles.btnGhost}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <ExternalLink size={11} />
                    </a>
                  </div>
                  {/* Child task rows */}
                  {(resultKeys.childKeys || []).map((key, i) => (
                    <div key={key} className={styles.issueRow}>
                      <TaskIcon />
                      <span className={styles.issueKey}>{key}</span>
                      <span className={styles.issueTitle}>{childTasks[i]?.summary || key}</span>
                      <span className={styles.badge}>{childTasks[i]?.pts ?? defaultPts} pts</span>
                      <a
                        href={jiraBaseUrl ? `${jiraBaseUrl.replace(/\/$/, '')}/browse/${key}` : '#'}
                        target="_blank"
                        rel="noreferrer"
                        className={`${styles.btn} ${styles.btnXs} ${styles.btnGhost}`}
                        style={{ textDecoration: 'none' }}
                      >
                        <ExternalLink size={11} />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

        </div>{/* /content */}

        {/* ── Footer ── */}
        <div className={styles.footer}>

          {/* Step 1 footer */}
          {step === 1 && (
            <>
              <button className={`${styles.btn} ${styles.btnGhost}`} onClick={onClose}>Cancel</button>
              <div className={styles.footerSpacer} />
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handleGenerate}
                disabled={jiraType === 'task' && !parentEpicKey}
              >
                Generate with AI →
              </button>
            </>
          )}

          {/* Step 2 footer */}
          {step === 2 && (
            <>
              <div className={styles.footerInfo}>
                <span className={isLoading ? '' : styles.successStatus}>
                  {isLoading ? 'Generating with AI Foundry · interruptible' : <><Check size={14} /> Generation complete</>}
                </span>
              </div>
              <div className={styles.footerSpacer} />
              <button
                className={`${styles.btn} ${styles.btnDanger}`}
                onClick={handleStopDiscard}
              >
                Stop &amp; discard
              </button>
              {streamedCount > 0 && (
                <button
                  className={`${styles.btn}`}
                  onClick={handleKeepPartial}
                >
                  Keep {streamedCount} task{streamedCount !== 1 ? 's' : ''}
                </button>
              )}
            </>
          )}

          {/* Step 3 footer */}
          {step === 3 && (
            <>
              <span className={styles.footerInfo}>
                {childTasks.length} task{childTasks.length !== 1 ? 's' : ''} · {totalPts(childTasks)} pts
              </span>
              <div className={styles.footerSpacer} />
              <button
                className={`${styles.btn} ${styles.btnGhost}`}
                onClick={() => {
                  if (childTasks.length > 0) setBackConfirm(true);
                  else setStep(1);
                }}
              >
                ← Back
              </button>
              <button
                className={`${styles.btn}`}
                onClick={handleSaveForLater}
              >
                Save for later
              </button>
              <button
                className={`${styles.btn} ${styles.btnPrimary}`}
                onClick={handlePush}
                disabled={isPushing || !epicData.summary}
              >
                {isPushing ? 'Pushing…' : `Push ${1 + childTasks.length} item${childTasks.length !== 0 ? 's' : ''} to Jira →`}
              </button>
            </>
          )}

          {/* Step 4 footer */}
          {step === 4 && (
            <>
              <span className={styles.successStatus}>
                <CheckCircle size={15} />
                {1 + (resultKeys.childKeys?.length || 0)} issues live
              </span>
              <div className={styles.footerSpacer} />
              <button className={`${styles.btn}`} onClick={onClose}>Done</button>
              <a
                className={`${styles.btn} ${styles.btnPrimary}`}
                href={jiraBaseUrl ? `${jiraBaseUrl.replace(/\/$/, '')}/browse/${resultKeys.issueKey}` : '#'}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: 'none' }}
              >
                Open epic in Jira ↗
              </a>
            </>
          )}

        </div>
      </div>{/* /window */}

      {/* ── Confirm: Back from Step 3 ── */}
      {backConfirm && (
        <ConfirmDialog
          title="Go back to Setup?"
          message="Going back will keep your current draft. You can resume editing from the draft banner."
          confirmText="Go back"
          cancelText="Stay"
          variant="primary"
          onConfirm={() => { setBackConfirm(false); setStep(1); }}
          onCancel={() => setBackConfirm(false)}
        />
      )}

      {/* ── Confirm: Close during active work ── */}
      {closeConfirm && (
        <ConfirmDialog
          title="Close without pushing?"
          message={
            step === 2 && isLoading
              ? "Generation is still in progress. Closing now will cancel the process. Any tasks revealed so far will be lost."
              : step === 2
                ? "Your generated tasks have been auto-saved as a draft. You can resume from the 'Push to Jira' button on this feature."
                : "Your changes are safe. A draft has been saved. You can resume editing from the Push to Jira button on this feature."
          }
          confirmText="Close"
          cancelText="Stay"
          variant="primary"
          onConfirm={() => { setCloseConfirm(false); onClose(); }}
          onCancel={() => setCloseConfirm(false)}
        />
      )}

    </div>
  );
};

export default PushToJiraModal;
