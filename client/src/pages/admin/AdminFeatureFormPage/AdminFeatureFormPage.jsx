import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import RichTextEditor from '../../../components/RichTextEditor';
import FeatureDetailView from '../../../components/FeatureDetailView';
import FeatureDetailModal from '../../../components/FeatureDetailModal';
import ConfirmDialog from '../../../components/ConfirmDialog';
import RevisionHistory from '../../../components/RevisionHistory';
import { getFeatures, createFeature, updateFeature, deleteFeature, getFeatureRevisions } from '../../../api/features';
import { getCategories } from '../../../api/categories';
import { getStages } from '../../../api/stages';
import { useToast } from '../../../contexts/ToastContext';
import styles from './AdminFeatureFormPage.module.css';

const AdminFeatureFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { addToast } = useToast();

  const [categories, setCategories] = useState([]);
  const [stages, setStages] = useState([]);
  const [revisions, setRevisions] = useState([]);
  const [maxVotes, setMaxVotes] = useState(0);
  const [loading, setLoading] = useState(isEdit);
  const [showPreview, setShowPreview] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, type: null, payload: null });
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category_id: '',
    status: 'under_review',
    stage_id: '',
    pinned: 0,
    tags: [],
    impact: 1,
    effort: 1,
    owner: '',
    key_stakeholder: '',
    priority: 'Medium',
    is_published: 1
  });

  useEffect(() => {
    const fetchData = async () => {
      const [cData, stData] = await Promise.all([
        getCategories(),
        getStages()
      ]);
      setCategories(cData);
      setStages(stData);

      if (isEdit) {
        try {
          const [res, revRes] = await Promise.all([
            getFeatures({ limit: 1000 }),
            getFeatureRevisions(id).catch(() => [])
          ]);
          setRevisions(Array.isArray(revRes) ? revRes : []);
          
          const fData = res.data || [];
          const currentMaxVotes = Math.max(...fData.map(f => f.vote_count || 0), 0);
          setMaxVotes(currentMaxVotes);
          
          const feature = fData.find(f => f.id === id);
          if (feature) {
            setFormData({
              title: feature.title,
              description: feature.description,
              category_id: feature.category_id || '',
              status: feature.status,
              stage_id: feature.stage_id || '',
              pinned: feature.pinned,
              tags: typeof feature.tags === 'string' ? JSON.parse(feature.tags) : feature.tags || [],
              impact: feature.impact || 1,
              effort: feature.effort || 1,
              owner: feature.owner || '',
              key_stakeholder: feature.key_stakeholder || '',
              priority: feature.priority || 'Medium',
              vote_count: feature.vote_count || 0,
              is_published: feature.is_published ?? 1
            });
          }
        } finally {
          setLoading(false);
        }
      }
    };
    fetchData();
  }, [id, isEdit]);

  const handleActionClick = (action) => {
    const form = document.getElementById('feature-form');
    if (form && form.reportValidity()) {
      requestSubmit(action);
    }
  };

  const requestSubmit = (isPublishAction) => {
    if (isEdit && formData.is_published === 1 && !isPublishAction) {
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
    setConfirmDialog({ isOpen: false, type: null, payload: null });
    try {
      const payload = { ...formData, is_published: isPublishAction ? 1 : 0 };
      if (isEdit) {
        await updateFeature(id, payload);
        addToast(isPublishAction ? 'Feature published' : 'Draft saved', 'success');
        // Refresh revisions since a save happened
        const revRes = await getFeatureRevisions(id).catch(() => []);
        setRevisions(Array.isArray(revRes) ? revRes : []);
        // Update local state to reflect current published status
        setFormData(prev => ({ ...prev, is_published: payload.is_published }));
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

  const handleTagsChange = (e) => {
    const tags = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, tags }));
  };

  const calculatedScore = useMemo(() => {
    const multipliers = { Low: 0.5, Medium: 1.0, High: 1.5, Critical: 2.0 };
    const m = multipliers[formData.priority] || 1.0;
    const v = formData.vote_count || 0;
    const votesNorm = maxVotes > 0 ? (v / maxVotes) * 5 : 0;
    const safeEffort = formData.effort > 0 ? formData.effort : 1;
    const raw = (votesNorm * formData.impact * m) / safeEffort;
    const score = Math.ceil((raw / 50) * 100);
    return Math.min(score, 100);
  }, [formData.impact, formData.effort, formData.priority, formData.vote_count, maxVotes]);

  const previewFeature = useMemo(() => {
    const category = categories.find(c => c.id === formData.category_id);
    const stage = stages.find(s => s.id === formData.stage_id);
    
    return {
      title: formData.title || 'Feature Title Preview',
      description: formData.description,
      category_name: category ? category.name : 'Uncategorized',
      category_icon: category ? category.icon : 'package',
      category_color: category ? category.color : '#64748b',
      stage_id: formData.stage_id,
      stage_name: stage ? stage.name : 'Unknown Status',
      stage_color: stage ? stage.color : '#94a3b8',
      vote_count: formData.vote_count || 0,
      user_voted: false,
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
          message="This action cannot be undone. All votes and data will be permanently deleted."
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

      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <div className={styles.breadcrumb}>ADMIN › {isEdit ? 'EDIT FEATURE' : 'NEW FEATURE'}</div>
            <h1 className={styles.h1}>
              {formData.title || (isEdit ? 'Editing Feature' : 'Create New Feature')}
              {isEdit && formData.is_published === 1 && (
                <span className={styles.publishedBadgeBadge}>Published</span>
              )}
            </h1>
          </div>
          
          <div className={styles.headerActions}>
            <button 
              type="button" 
              className={styles.previewBtn}
              onClick={() => setShowPreview(true)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.icon}>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
              Live Preview
            </button>
            {isEdit && (
              <button 
                type="button" 
                className={styles.previewBtn}
                onClick={() => setShowHistory(true)}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.icon}>
                  <path d="M12 8v4l3 3M3 12a9 9 0 1018 0 9 9 0 00-18 0z" />
                </svg>
                History
              </button>
            )}
          </div>
        </header>

        <form id="feature-form" onSubmit={(e) => e.preventDefault()} className={styles.form}>
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

          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Current Status</label>
              <select 
                value={formData.stage_id || formData.status} 
                onChange={(e) => setFormData(prev => ({ ...prev, stage_id: e.target.value }))}
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
                  max="5" 
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
                  max="5" 
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
            <div className={`${styles.gravityPreview} ${
              calculatedScore >= 60 ? styles.gravityHigh : 
              calculatedScore >= 30 ? styles.gravityMid : 
              styles.gravityLow
            }`}>
              <div className={styles.gravityPreviewLabel}>Estimated Gravity Score</div>
              <div className={styles.gravityPreviewValue}>
                <span className={styles.gravityIcon}>⚡</span>
                {calculatedScore}
                <span className={styles.gravityMax}>/ 100</span>
              </div>
            </div>
            <p className={styles.gravityHelpText}>
              This score is calculated based on votes ({formData.vote_count || 0}), impact, effort, and strategic priority. Or {maxVotes} max votes.
            </p>
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
              <input 
                type="text" 
                value={formData.owner} 
                onChange={(e) => setFormData(prev => ({ ...prev, owner: e.target.value }))}
                className={styles.input}
                placeholder="Name (Area/Team)"
              />
            </div>

            <div className={styles.field}>
              <label className={styles.label}>Key Stakeholder</label>
              <input 
                type="text" 
                value={formData.key_stakeholder} 
                onChange={(e) => setFormData(prev => ({ ...prev, key_stakeholder: e.target.value }))}
                className={styles.input}
                placeholder="User/Department"
              />
            </div>
          </div>

          <div className={styles.field}>
            <label className={styles.label}>Tags (comma-separated)</label>
            <input 
              type="text" 
              value={formData.tags.join(', ')} 
              onChange={handleTagsChange}
              className={styles.input}
              placeholder="UI/UX, Mobile, Student Portal, API..."
            />
          </div>

          <div className={styles.fieldRow}>
            <input 
              type="checkbox" 
              id="pinned"
              checked={formData.pinned === 1} 
              onChange={(e) => setFormData(prev => ({ ...prev, pinned: e.target.checked ? 1 : 0 }))}
              className={styles.checkbox}
            />
            <label htmlFor="pinned" className={styles.checkboxLabel}>Pin feature to top of public roadmap</label>
          </div>

          <RevisionHistory 
            isOpen={showHistory}
            onClose={() => setShowHistory(false)}
            revisions={revisions} 
            categories={categories} 
            stages={stages} 
          />

        </form>
      </div>

      <div className={styles.stickyFooterArea}>
        <div className={styles.stickyFooterInner}>
          <div className={styles.leftActions}>
            {isEdit && (
              <button type="button" onClick={requestDelete} className={styles.deleteBtn}>Delete Feature</button>
            )}
          </div>
          <div className={styles.formFooterActions}>
            <button type="button" onClick={requestDiscard} className={styles.secondaryBtn}>Discard Changes</button>
            <button type="button" onClick={() => handleActionClick(false)} className={styles.secondaryBtn}>
              {isEdit && formData.is_published === 0 ? 'Save Draft Updates' : 'Save as Draft'}
            </button>
            <button type="button" onClick={() => handleActionClick(true)} className={styles.submitBtn}>
              {isEdit && formData.is_published === 1 ? 'Save Published Changes' : 'Publish Feature'}
            </button>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminFeatureFormPage;
