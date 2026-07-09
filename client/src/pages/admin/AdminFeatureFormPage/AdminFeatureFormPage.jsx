import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import RichTextEditor from '../../../components/RichTextEditor';
import FeatureDetailView from '../../../components/FeatureDetailView';
import InternalNotesLog from '../../../components/InternalNotesLog/InternalNotesLog';
import FeatureDetailModal from '../../../components/FeatureDetailModal';
import ConfirmDialog from '../../../components/ConfirmDialog';
import RevisionHistory from '../../../components/RevisionHistory';
import TagAutocomplete from '../../../components/TagAutocomplete/TagAutocomplete';
import StringAutocomplete from '../../../components/StringAutocomplete/StringAutocomplete';
import FeatureDependencyAutocomplete from '../../../components/FeatureDependencyAutocomplete/FeatureDependencyAutocomplete';
import { getFeatures, getFeatureById, createFeature, updateFeature, deleteFeature, getFeatureRevisions, getFeatureTags, getFeatureOwners, getFeatureStakeholders } from '../../../api/features';
import { getCategories } from '../../../api/categories';
import { getStages } from '../../../api/stages';
import { calculateGravityScore } from '@shared/lib/gravityScore.js';
import { useToast } from '../../../contexts/ToastContext';
import { Eye, Clock, AlertTriangle, ExternalLink, Unlink, Zap, Link2, Plus } from 'lucide-react';
import { useEditLock } from './useEditLock';
import PushToJiraModal from '../../../components/PushToJiraModal/PushToJiraModal';
import { fetchJiraConfig, fetchJiraDraft, unlinkJiraFeature, fetchJiraIssues, linkJiraIssue } from '../../../api/jira';
import VerifiedBadge from '../../../components/VerifiedBadge';
import styles from './AdminFeatureFormPage.module.css';

const JiraLogo = ({ size = 16, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    className={className}
    style={{ display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path fill="var(--tile-color,#1868db)" d="M0 6a6 6 0 0 1 6-6h12a6 6 0 0 1 6 6v12a6 6 0 0 1-6 6H6a6 6 0 0 1-6-6z" />
    <path fill="var(--icon-color, white)" d="M9.051 15.434H7.734c-1.988 0-3.413-1.218-3.413-3h7.085c.367 0 .605.26.605.63v7.13c-1.772 0-2.96-1.435-2.96-3.434zm3.5-3.543h-1.318c-1.987 0-3.413-1.196-3.413-2.978h7.085c.367 0 .627.239.627.608v7.13c-1.772 0-2.981-1.435-2.981-3.434zm3.52-3.522h-1.317c-1.987 0-3.413-1.217-3.413-3h7.085c.367 0 .605.262.605.61v7.129c-1.771 0-2.96-1.435-2.96-3.434z" />
  </svg>
);

const AdminFeatureFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { addToast } = useToast();

  const [categories, setCategories] = useState([]);
  const [stages, setStages] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [ownerSuggestions, setOwnerSuggestions] = useState([]);
  const [stakeholderSuggestions, setStakeholderSuggestions] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showJiraModal, setShowJiraModal] = useState(false);
  const [jiraBaseUrl, setJiraBaseUrl] = useState('');
  const [jiraDraft, setJiraDraft] = useState(null);
  const [jiraIssueSummaries, setJiraIssueSummaries] = useState({});
  const [linkInput,  setLinkInput]  = useState('');
  const [linkRole,   setLinkRole]   = useState('primary');
  const [isLinking,  setIsLinking]  = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: null, payload: null });
  const [isSaving, setIsSaving] = useState(false);
  const [notesSummary, setNotesSummary] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    status: 'under_review',
    stage_id: '',
    pinned: false,
    tags: [],
    impact: 5,
    effort: 5,
    owner: '',
    key_stakeholder: '',
    priority: 'Medium',
    is_published: true,
    is_reviewed: false,
    dependencies: [],
    jira_issue_key: '',
    jira_child_keys: []
  });
  const [isDirty, setIsDirty] = useState(false);
  const initialLoadDone = useRef(false);
  const skipDirtyRef = useRef(false);
  const abortedRef = useRef(false);
  const formRef = useRef(null);
  const { otherEditor } = useEditLock(isEdit ? id : null);

  // Mark dirty on any form change after initial load
  useEffect(() => {
    if (initialLoadDone.current && !skipDirtyRef.current) {
      setIsDirty(true);
    }
    skipDirtyRef.current = false;
  }, [formData]);

  // Warn on browser tab close / refresh
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  // Fetch Jira issue names for all linked keys whenever they change
  const linkedJiraKeys = useMemo(() => {
    const keys = [
      ...(formData.jira_issue_key ? [formData.jira_issue_key] : []),
      ...(formData.jira_child_keys || [])
    ].filter(Boolean);
    return keys.join(',');
  }, [formData.jira_issue_key, formData.jira_child_keys]);

  useEffect(() => {
    if (!linkedJiraKeys || !jiraBaseUrl) return;
    fetchJiraIssues(linkedJiraKeys.split(','))
      .then(data => {
        const map = {};
        (data?.issues || []).forEach(issue => { map[issue.key] = issue.summary; });
        setJiraIssueSummaries(map);
      })
      .catch(() => {}); // non-critical — page works without summaries
  }, [linkedJiraKeys, jiraBaseUrl]);

  // Keep linkRole in sync: default to Primary when no primary exists, Child otherwise
  useEffect(() => {
    setLinkRole(formData.jira_issue_key ? 'child' : 'primary');
  }, [formData.jira_issue_key]);

  // Warn on in-app navigation (link clicks) — uses app ConfirmDialog, not window.confirm
  useEffect(() => {
    const handleClick = (e) => {
      if (!isDirty) return;
      const link = e.target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (href === window.location.pathname) return;
      // Allow external links and new-tab links to pass through untouched
      if (link.target === '_blank') return;
      if (href.startsWith('http://') || href.startsWith('https://')) return;
      // Intercept: show app dialog instead of browser confirm
      e.preventDefault();
      e.stopPropagation();
      setConfirmDialog({ isOpen: true, type: 'navGuard', payload: href });
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isDirty]);

  useEffect(() => {
    abortedRef.current = false;
    const fetchData = async () => {
      const [cData, stData, tagData, ownerData, stakeholderData, jiraConf, draftRes] = await Promise.all([
        getCategories(),
        getStages(),
        getFeatureTags().catch(() => []),
        getFeatureOwners().catch(() => []),
        getFeatureStakeholders().catch(() => []),
        fetchJiraConfig().catch(() => null),
        isEdit ? fetchJiraDraft(id).catch(() => null) : Promise.resolve(null)
      ]);
      if (abortedRef.current) return;
      setCategories(cData);
      if (abortedRef.current) return;
      setStages(stData);
      if (abortedRef.current) return;
      setTagSuggestions(Array.isArray(tagData) ? tagData : []);
      if (abortedRef.current) return;
      setOwnerSuggestions(Array.isArray(ownerData) ? ownerData : []);
      if (abortedRef.current) return;
      setStakeholderSuggestions(Array.isArray(stakeholderData) ? stakeholderData : []);
      if (jiraConf && /^https:\/\//i.test(jiraConf.baseUrl)) {
        setJiraBaseUrl(jiraConf.baseUrl);
      }
      if (draftRes?.featureId) {
        setJiraDraft(draftRes);
      }

      if (isEdit) {
        try {
          const [feature, revRes] = await Promise.all([
            getFeatureById(id),
            getFeatureRevisions(id).catch(() => [])
          ]);
          if (abortedRef.current) return;
          setRevisions(Array.isArray(revRes) ? revRes : []);

          if (feature) {
            if (abortedRef.current) return;
            setNotesSummary(feature.notes_summary || null);
            setFormData({
              title: feature.title,
              description: feature.description,
              category_id: feature.category_id || '',
              status: feature.status,
              stage_id: feature.stage_id || '',
              pinned: feature.pinned,
              tags: typeof feature.tags === 'string' ? (() => { try { return JSON.parse(feature.tags); } catch { return []; } })() : feature.tags || [],
              impact: feature.impact || 1,
              effort: feature.effort || 1,
              owner: feature.owner || '',
              key_stakeholder: feature.key_stakeholder || '',
              priority: feature.priority || 'Medium',
              is_published: feature.is_published ?? true,
              is_reviewed: feature.is_reviewed ?? false,
              jira_issue_key: feature.jira_issue_key || '',
              jira_child_keys: Array.isArray(feature.jira_child_keys) ? feature.jira_child_keys : [],
              dependencies: (feature.dependency_details || feature.dependencies || []).map(d =>
                typeof d === 'string' ? { id: d, title: d, stage_name: '--', stage_color: '#94a3b8', owner: '', key_stakeholder: '', gravity_score: 0 } : { id: d.id, title: d.title, stage_name: d.stage_name || '--', stage_color: d.stage_color || '#94a3b8', owner: d.owner || '', key_stakeholder: d.key_stakeholder || '', gravity_score: d.gravity_score || 0 }
              )
            });
            skipDirtyRef.current = true;
            setIsDirty(false);
          }
        } finally {
          setLoading(false);
          initialLoadDone.current = true;
        }
      } else {
        setLoading(false);
        initialLoadDone.current = true;
      }
    };
    fetchData();
    return () => { abortedRef.current = true; };
  }, [id, isEdit]);

  const handleActionClick = (action) => {
    const form = formRef.current;
    if (form && form.reportValidity()) {
      requestSubmit(action);
    }
  };

  const requestSubmit = (isPublishAction) => {
    if (isEdit && formData.is_published && !isPublishAction) {
      setConfirmDialog({
        isOpen: true,
        type: 'unpublish',
        payload: isPublishAction
      });
      return;
    }
    executeSubmit(isPublishAction);
  };

  const executeSubmit = async (isPublishAction) => {
    setIsSaving(true);
    setConfirmDialog({ isOpen: false, type: null, payload: null });
    try {
      const payload = { ...formData, is_published: !!isPublishAction, dependencies: formData.dependencies.map(d => d.id) };
      if (isEdit) {
        await updateFeature(id, payload);
        addToast(isPublishAction ? 'Feature published' : 'Draft saved', 'success');
        skipDirtyRef.current = true;
        setIsDirty(false);
        navigate('/admin');
      } else {
        const result = await createFeature(payload);
        addToast(isPublishAction ? 'Feature published' : 'Draft created', 'success');
        // Redirect to edit page of the newly created feature
        if (result && result.id) {
          navigate(`/admin/features/${result.id}/edit`);
        } else {
          navigate('/admin');
        }
      }
    } catch (err) {
      addToast(err.error || 'Failed to save feature', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const requestDelete = () => {
    setConfirmDialog({ isOpen: true, type: 'delete' });
  };

  const executeDelete = async () => {
    try {
      await deleteFeature(id);
      addToast('Feature deleted', 'success');
      navigate('/admin');
    } catch (err) {
      addToast('Failed to delete feature', 'error');
    }
  };

  const requestDiscard = () => {
    setConfirmDialog({ isOpen: true, type: 'discard' });
  };

  const executeDiscard = () => {
    navigate('/admin');
  };

  const handleLinkIssue = async () => {
    const key = linkInput.trim().toUpperCase();
    if (!key) return;
    // Replacing an existing primary requires confirmation
    if (linkRole === 'primary' && formData.jira_issue_key) {
      setConfirmDialog({ isOpen: true, type: 'replacePrimary', payload: key });
      return;
    }
    await executeLinkIssue(key, linkRole);
  };

  const executeLinkIssue = async (key, role) => {
    setIsLinking(true);
    try {
      const res = await linkJiraIssue(id, { issueKey: key, role });
      if (role === 'primary') {
        setFormData(prev => ({
          ...prev,
          jira_issue_key:   res.issueKey,
          jira_child_keys:  res.childKeys || []
        }));
      } else {
        // Use authoritative array from server to prevent client/server drift
        setFormData(prev => ({ ...prev, jira_child_keys: res.childKeys || [] }));
      }
      setLinkInput('');
      const childMsg = res.childKeys?.length ? ` and ${res.childKeys.length} child task${res.childKeys.length !== 1 ? 's' : ''}` : '';
      addToast(`Linked ${res.issueKey}${childMsg}`, 'success');
    } catch (err) {
      addToast(err?.error || 'Could not link issue. Check the key and try again.', 'error');
    } finally {
      setIsLinking(false);
    }
  };

  const executeNavGuard = () => {
    const href = confirmDialog.payload;
    setConfirmDialog({ isOpen: false, type: null, payload: null });
    navigate(href);
  };

  const executeUnlinkJira = async () => {
    const issueKey = confirmDialog.payload;
    setConfirmDialog({ isOpen: false, type: null, payload: null });

    try {
      await unlinkJiraFeature(id, issueKey);
      if (issueKey) {
        // Targeted unlink — refresh local state precisely
        setFormData(prev => {
          if (prev.jira_issue_key === issueKey) {
            // Unlinked the parent epic → all children go too
            return { ...prev, jira_issue_key: '', jira_child_keys: [] };
          }
          // Unlinked a single child
          return {
            ...prev,
            jira_child_keys: prev.jira_child_keys.filter(k => k !== issueKey)
          };
        });
        addToast(`Unlinked ${issueKey}`, 'success');
      } else {
        // Unlink all
        setFormData(prev => ({ ...prev, jira_issue_key: '', jira_child_keys: [] }));
        addToast('Jira links removed from this feature', 'success');
      }
    } catch (err) {
      addToast(err.error || 'Failed to unlink Jira issue', 'error');
    }
  };

  const calculatedScore = useMemo(() => {
    return calculateGravityScore(formData.impact, formData.effort, formData.priority);
  }, [formData.impact, formData.effort, formData.priority]);

  const previewFeature = useMemo(() => {
    const category = categories.find(c => c.id === formData.category_id);
    const stage = stages.find(s => s.id === formData.stage_id);

    return {
      title: formData.title || 'Feature Title Preview',
      description: formData.description,
      dependency_details: formData.dependencies,
      category_name: category ? category.name : 'Uncategorized',
      category_icon: category ? category.icon : 'package',
      category_color: category ? category.color : '#64748b',
      stage_id: formData.stage_id,
      stage_name: stage ? stage.name : 'Unknown Status',
      stage_color: stage ? stage.color : '#94a3b8',
      tags: formData.tags
    };
  }, [formData, categories, stages]);

  if (loading) return (
    <AdminLayout>
      <div className={styles.message}>Loading editor...</div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      {showJiraModal && (
        <PushToJiraModal
          feature={formData}
          featureId={id}
          jiraBaseUrl={jiraBaseUrl}
          initialDraft={jiraDraft}
          onClose={() => setShowJiraModal(false)}
          onPushSuccess={(key, childKeys) => {
            setFormData(prev => ({ ...prev, jira_issue_key: key, jira_child_keys: Array.isArray(childKeys) ? childKeys : [] }));
            setJiraDraft(null);
          }}
          onDraftChange={(draft) => {
            setJiraDraft(draft); // null = discarded; object = saved
          }}
        />
      )}
      
      {showPreview && (
        <FeatureDetailModal
          feature={previewFeature}
          isAdmin={true}
          onClose={() => setShowPreview(false)}
        />
      )}

      {confirmDialog.isOpen && confirmDialog.type === 'unpublish' && (
        <ConfirmDialog
          title="Unpublish Feature?"
          message="This will remove the feature from the public roadmap immediately. Are you sure you want to revert to a draft?"
          confirmText="Yes, Unpublish"
          onConfirm={() => executeSubmit(confirmDialog.payload)}
          onCancel={() => setConfirmDialog({ isOpen: false, type: null })}
        />
      )}
      {confirmDialog.isOpen && confirmDialog.type === 'delete' && (
        <ConfirmDialog
          title="Delete Feature?"
          message="This action cannot be undone. All data will be permanently deleted."
          confirmText="Delete Feature"
          onConfirm={executeDelete}
          onCancel={() => setConfirmDialog({ isOpen: false, type: null })}
        />
      )}
      {confirmDialog.isOpen && confirmDialog.type === 'discard' && (
        <ConfirmDialog
          title="Discard Changes?"
          message="You have unsaved changes. Are you sure you want to discard them and return to the dashboard?"
          confirmText="Discard Changes"
          onConfirm={executeDiscard}
          onCancel={() => setConfirmDialog({ isOpen: false, type: null })}
        />
      )}
      {confirmDialog.isOpen && confirmDialog.type === 'replacePrimary' && (
        <ConfirmDialog
          title="Replace primary issue?"
          message={`This will replace ${formData.jira_issue_key} as the primary and re-link its child tasks. The existing link data will be overwritten.`}
          confirmText="Replace"
          onConfirm={() => {
            const key = confirmDialog.payload;
            setConfirmDialog({ isOpen: false, type: null, payload: null });
            executeLinkIssue(key, 'primary');
          }}
          onCancel={() => setConfirmDialog({ isOpen: false, type: null, payload: null })}
        />
      )}
      {confirmDialog.isOpen && confirmDialog.type === 'navGuard' && (
        <ConfirmDialog
          title="Leave without saving?"
          message="You have unsaved changes that will be lost if you navigate away. Are you sure you want to leave?"
          confirmText="Leave page"
          cancelText="Stay"
          variant="primary"
          onConfirm={executeNavGuard}
          onCancel={() => setConfirmDialog({ isOpen: false, type: null, payload: null })}
        />
      )}
      {confirmDialog.isOpen && confirmDialog.type === 'unlinkJira' && (
        <ConfirmDialog
          title="Unlink Jira Issue?"
          message={`Unlink ${confirmDialog.payload} from this feature? The issue in Jira will NOT be deleted.`}
          confirmText="Unlink"
          onConfirm={executeUnlinkJira}
          onCancel={() => setConfirmDialog({ isOpen: false, type: null, payload: null })}
        />
      )}

      {otherEditor && (
        <div className={styles.editLockBanner}>
          <AlertTriangle size={16} strokeWidth={2.5} />
          <span>
            <strong>{otherEditor.name || otherEditor.email}</strong> is also editing this feature.
            Your save may overwrite their changes.
          </span>
        </div>
      )}

      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.h1}>
              {isEdit && (formData.is_published || formData.is_reviewed) && (
                <div className={styles.headerBadges}>
                  {formData.is_published && (
                    <span className={styles.publishedBadgeBadge}>Published</span>
                  )}
                  {formData.is_reviewed && (
                    <VerifiedBadge size={23} className={styles.headerReviewedBadge} />
                  )}
                  {formData.jira_issue_key && (
                    <a href={jiraBaseUrl ? `${jiraBaseUrl.replace(/\/$/, '')}/browse/${formData.jira_issue_key}` : `/browse/${formData.jira_issue_key}`} target="_blank" rel="noreferrer" className={styles.publishedBadgeBadge} style={{ backgroundColor: '#0052cc', color: 'white', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <ExternalLink size={12} /> {formData.jira_issue_key}
                    </a>
                  )}
                </div>
              )}
              {formData.title || (isEdit ? 'Editing Feature' : 'Create New Feature')}

            </h1>
          </div>

        </header>
        <form id="feature-form" ref={formRef} onSubmit={(e) => e.preventDefault()} className={styles.form}>


          <div className={styles.field}>
            <label className={styles.label}>Feature Title</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className={styles.input}
              placeholder="e.g. Simplified Timetable View"
              required
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <RichTextEditor
              value={formData.description}
              onChange={(val) => setFormData(prev => ({ ...prev, description: val }))}
              placeholder="Describe the problem this feature solves and who it is for..."
            />
          </div>

          {isEdit && (
            <div className={styles.field}>
              <InternalNotesLog featureId={id} initialSummary={notesSummary} />
            </div>
          )}

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Current Status</label>
              <select
                value={formData.stage_id || formData.status}
                onChange={(e) => {
                  const value = e.target.value;
                  const stage = stages.find(s => s.id === value);
                  setFormData(prev => ({ ...prev, stage_id: value, status: stage?.slug || prev.status }));
                }}
                className={styles.select}
              >
                {stages.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Application Category</label>
              <select
                value={formData.category_id}
                onChange={(e) => setFormData(prev => ({ ...prev, category_id: e.target.value }))}
                className={styles.select}
              >
                <option value="">(No Category Assigned)</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Impact ({formData.impact})</label>
              <div className={styles.sliderContainer}>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formData.impact}
                  onChange={(e) => setFormData(prev => ({ ...prev, impact: parseInt(e.target.value) }))}
                  className={styles.rangeInput}
                />
                <div className={styles.sliderLabels}>
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Effort ({formData.effort})</label>
              <div className={styles.sliderContainer}>
                <input
                  type="range"
                  min="1"
                  max="10"
                  value={formData.effort}
                  onChange={(e) => setFormData(prev => ({ ...prev, effort: parseInt(e.target.value) }))}
                  className={styles.rangeInput}
                />
                <div className={styles.sliderLabels}>
                  <span>Low</span>
                  <span>High</span>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.priorityPreviewRow}>
            <div className={`${styles.gravityPreview} ${calculatedScore >= 75 ? styles.gravityHigh :
              calculatedScore >= 50 ? styles.gravityMid :
                styles.gravityLow
              }`}>
              <div className={styles.gravityPreviewLabel}>Estimated Gravity Score</div>
              <div className={styles.gravityPreviewValue}>
                <Zap size={20} className={styles.gravityIcon} />
                {calculatedScore}
                <span className={styles.gravityMax}>/ 100</span>
              </div>
            </div>
          </div>

          <div className={styles.categoryDivider}>Strategic Internal Data (Admin Only)</div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Strategic Priority</label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData(prev => ({ ...prev, priority: e.target.value }))}
                className={styles.select}
              >
                <option value="Low">Low Priority</option>
                <option value="Medium">Medium Priority</option>
                <option value="High">High Priority</option>
                <option value="Critical">Critical / Blocker</option>
              </select>
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Feature Owner</label>
              <StringAutocomplete
                value={formData.owner}
                onChange={(owner) => setFormData(prev => ({ ...prev, owner }))}
                suggestions={ownerSuggestions}
                placeholder="Name (Area/Team)"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Key Stakeholder</label>
              <StringAutocomplete
                value={formData.key_stakeholder}
                onChange={(key_stakeholder) => setFormData(prev => ({ ...prev, key_stakeholder }))}
                suggestions={stakeholderSuggestions}
                placeholder="User/Department"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Tags</label>
            <TagAutocomplete
              selected={formData.tags}
              onChange={(tags) => setFormData(prev => ({ ...prev, tags }))}
              suggestions={tagSuggestions}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Dependencies (Admin Only)</label>
            <p className={styles.fieldHint}>Link to other features this depends on. Only visible to admins.</p>
            <FeatureDependencyAutocomplete
              selected={formData.dependencies}
              onChange={(deps) => setFormData(prev => ({ ...prev, dependencies: deps }))}
              excludeId={id}
            />
          </div>

          <div className={styles.fieldRow}>
            <input
              type="checkbox"
              id="pinned"
              checked={!!formData.pinned}
              onChange={(e) => setFormData(prev => ({ ...prev, pinned: e.target.checked }))}
              className={styles.checkbox}
            />
            <label htmlFor="pinned" className={styles.checkboxLabel}>Pin feature to top of public roadmap</label>
          </div>

          <div className={styles.fieldRow}>
            <input
              type="checkbox"
              id="reviewed"
              checked={!!formData.is_reviewed}
              onChange={(e) => setFormData(prev => ({ ...prev, is_reviewed: e.target.checked }))}
              className={styles.checkbox}
            />
            <label htmlFor="reviewed" className={styles.checkboxLabel}>
              <VerifiedBadge size={22} className={styles.reviewedIcon} />
              Reviewed
            </label>
          </div>

          <RevisionHistory
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
            revisions={revisions}
            categories={categories}
            stages={stages}
          />

        </form>

        {isEdit && (
          <div className={styles.jiraCard}>
            <h3 className={styles.jiraCardTitle}>Jira Integration</h3>
            <div className={styles.jiraSection}>
              
              {/* Upper Section: Centered Push Button and AI Instructions */}
              <div className={styles.jiraPushContainer}>
                <p className={styles.jiraPushInstructions}>
                  Generate a structured Epic and its corresponding child Tasks in Jira using AI, or update the issues if they have already been generated.
                </p>
                <button
                  type="button"
                  className={styles.jiraBtn}
                  onClick={() => setShowJiraModal(true)}
                >
                  <JiraLogo size={20} className={styles.jiraBtnIcon} />
                  <span>{formData.jira_issue_key ? 'Re-generate Jira Issues' : 'Generate Jira Issues'}</span>
                  {jiraDraft && <span className={styles.draftBadge}>· Draft saved</span>}
                </button>
              </div>

              {/* Middle Section: Linked Issues */}
              {Boolean(formData.jira_issue_key || (formData.jira_child_keys && formData.jira_child_keys.length > 0)) && (
                <div className={styles.jiraLinkedSection}>
                  <p className={styles.fieldHint}>Linked Jira Issues</p>
                  <ul className={styles.jiraList}>
                    {formData.jira_issue_key && (
                      <li className={styles.jiraItem}>
                        <div className={styles.jiraItemLeft}>
                          <span className={styles.jiraTypeIconEpic}>E</span>
                          <a
                            href={jiraBaseUrl ? `${jiraBaseUrl.replace(/\/$/, '')}/browse/${formData.jira_issue_key}` : `/browse/${formData.jira_issue_key}`}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.jiraItemKeyLink}
                          >
                            {formData.jira_issue_key}
                            <ExternalLink size={10} />
                          </a>
                          {jiraIssueSummaries[formData.jira_issue_key] && (
                            <span className={styles.jiraItemName}>
                              {jiraIssueSummaries[formData.jira_issue_key]}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className={styles.jiraRowUnlinkBtn}
                          onClick={() => setConfirmDialog({ isOpen: true, type: 'unlinkJira', payload: formData.jira_issue_key })}
                          title="Unlink this issue"
                        >
                          <Unlink size={13} />
                          <span>Unlink</span>
                        </button>
                      </li>
                    )}
                    {formData.jira_child_keys && formData.jira_child_keys.map(key => (
                      <li key={key} className={styles.jiraItem}>
                        <div className={styles.jiraItemLeft}>
                          <span className={styles.jiraTypeIconTask}>T</span>
                          <a
                            href={jiraBaseUrl ? `${jiraBaseUrl.replace(/\/$/, '')}/browse/${key}` : `/browse/${key}`}
                            target="_blank"
                            rel="noreferrer"
                            className={styles.jiraItemKeyLink}
                          >
                            {key}
                            <ExternalLink size={10} />
                          </a>
                          {jiraIssueSummaries[key] && (
                            <span className={styles.jiraItemName}>
                              {jiraIssueSummaries[key]}
                            </span>
                          )}
                        </div>
                        <button
                          type="button"
                          className={styles.jiraRowUnlinkBtn}
                          onClick={() => setConfirmDialog({ isOpen: true, type: 'unlinkJira', payload: key })}
                          title="Unlink this issue"
                        >
                          <Unlink size={13} />
                          <span>Unlink</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Bottom Section: Link Existing Issue */}
              <div className={styles.linkIssueSection}>
                <div className={styles.linkIssueSectionHeader}>
                  <span className={styles.linkIssueSectionTitle}>Link an existing issue</span>
                  <p className={styles.linkIssueSectionHint}>
                    Associate an existing Jira epic or task with this feature. Linking an epic will automatically include its child tasks.
                  </p>
                </div>
                <div className={styles.linkIssueForm}>
                  <div className={styles.linkInputWrapper}>
                    <Link2 size={14} className={styles.linkInputIcon} />
                    <input
                      className={styles.linkIssueInput}
                      value={linkInput}
                      onChange={e => setLinkInput(e.target.value.toUpperCase())}
                      onKeyDown={e => e.key === 'Enter' && handleLinkIssue()}
                      placeholder="e.g. LTD-42"
                      disabled={isLinking}
                      maxLength={20}
                      autoComplete="off"
                    />
                  </div>
                  <div className={styles.roleToggle}>
                    <button
                      type="button"
                      className={`${styles.roleBtn}${linkRole === 'primary' ? ' ' + styles.active : ''}`}
                      onClick={() => setLinkRole('primary')}
                    >
                      Primary Epic
                    </button>
                    <button
                      type="button"
                      className={`${styles.roleBtn}${linkRole === 'child' ? ' ' + styles.active : ''}`}
                      onClick={() => setLinkRole('child')}
                    >
                      Child Task
                    </button>
                  </div>
                  <button
                    type="button"
                    className={styles.linkIssueBtn}
                    onClick={handleLinkIssue}
                    disabled={isLinking || !linkInput.trim()}
                  >
                    {isLinking ? (
                      'Linking…'
                    ) : (
                      <>
                        <Plus size={14} />
                        <span>Link Issue</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {isEdit && (
          <div className={styles.deleteSection}>
            <button type="button" onClick={requestDelete} className={styles.deleteBtn}>Delete Feature</button>
          </div>
        )}
      </div>

      <div className={styles.stickyFooterArea}>
        <div className={styles.stickyFooterInner}>
          <div className={styles.leftActions}>
            <button
              type="button"
              className={styles.iconBtn}
              onClick={() => setShowPreview(true)}
              title="Preview"
              aria-label="Preview"
            >
              <Eye size={18} strokeWidth={2.5} />
            </button>
            {isEdit && (
              <button
                type="button"
                className={styles.iconBtn}
                onClick={() => setShowHistory(true)}
                title="History"
                aria-label="History"
              >
                <Clock size={18} strokeWidth={2.5} />
              </button>
            )}
          </div>
          <div className={styles.formFooterActions}>
            <button type="button" onClick={requestDiscard} className={styles.secondaryBtn} disabled={isSaving || loading}>Discard Changes</button>
            <button type="button" onClick={() => handleActionClick(false)} className={styles.secondaryBtn} disabled={isSaving || loading || (isEdit && !isDirty)}>
              {isEdit && !formData.is_published ? 'Save Draft Updates' : 'Save as Draft'}
            </button>
            <button type="button" onClick={() => handleActionClick(true)} className={styles.submitBtn} disabled={isSaving || loading || (isEdit && !isDirty)}>
              {isEdit && formData.is_published ? 'Save Published Changes' : 'Publish Feature'}
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminFeatureFormPage;
