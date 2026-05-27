import { useEffect, useState, useMemo, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import RichTextEditor from '../../../components/RichTextEditor';
import FeatureDetailView from '../../../components/FeatureDetailView';
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
import { Eye, Clock, AlertTriangle } from 'lucide-react';
import { useEditLock } from './useEditLock';
import VerifiedBadge from '../../../components/VerifiedBadge';
import styles from './AdminFeatureFormPage.module.css';

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
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: null, payload: null });
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    internal_notes: '',
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
    dependencies: []
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

  // Warn on in-app navigation (link clicks)
  useEffect(() => {
    const handleClick = (e) => {
      if (!isDirty) return;
      const link = e.target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      if (href === window.location.pathname) return;
      const confirmed = window.confirm('You have unsaved changes. Are you sure you want to leave this page?');
      if (!confirmed) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, [isDirty]);

  useEffect(() => {
    abortedRef.current = false;
    const fetchData = async () => {
      const [cData, stData, tagData, ownerData, stakeholderData] = await Promise.all([
        getCategories(),
        getStages(),
        getFeatureTags().catch(() => []),
        getFeatureOwners().catch(() => []),
        getFeatureStakeholders().catch(() => [])
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
            setFormData({
              title: feature.title,
              description: feature.description,
              internal_notes: feature.internal_notes || '',
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

  const calculatedScore = useMemo(() => {
    return calculateGravityScore(formData.impact, formData.effort, formData.priority);
  }, [formData.impact, formData.effort, formData.priority]);

  const previewFeature = useMemo(() => {
    const category = categories.find(c => c.id === formData.category_id);
    const stage = stages.find(s => s.id === formData.stage_id);

    return {
      title: formData.title || 'Feature Title Preview',
      description: formData.description,
      internal_notes: formData.internal_notes,
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

          <div className={styles.field}>
            <label className={styles.label}>Internal Notes (Admin Only)</label>
            <p className={styles.fieldHint}>These notes are only visible to administrators and will never appear on the public roadmap.</p>
            <RichTextEditor
              value={formData.internal_notes}
              onChange={(val) => setFormData(prev => ({ ...prev, internal_notes: val }))}
              placeholder="Add internal planning notes, strategic context, or discussion points..."
            />
          </div>

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
                <span className={styles.gravityIcon}>⚡</span>
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
