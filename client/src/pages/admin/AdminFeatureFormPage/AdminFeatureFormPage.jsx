import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import RichTextEditor from '../../../components/RichTextEditor';
import { getFeatures, createFeature, updateFeature } from '../../../api/features';
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
  const [maxVotes, setMaxVotes] = useState(0);
  const [loading, setLoading] = useState(isEdit);
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
    priority: 'Medium'
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
          const res = await getFeatures({ limit: 1000 });
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
              vote_count: feature.vote_count || 0
            });
          }
        } finally {
          setLoading(false);
        }
      }
    };
    fetchData();
  }, [id, isEdit]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEdit) {
        await updateFeature(id, formData);
        addToast('Feature updated', 'success');
      } else {
        await createFeature(formData);
        addToast('Feature created', 'success');
      }
      navigate('/admin');
    } catch (err) {
      addToast(err.error || 'Failed to save feature', 'error');
    }
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

  if (loading) return (
    <AdminLayout>
      <div className={styles.message}>Loading editor...</div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <div className={styles.breadcrumb}>ADMIN › {isEdit ? 'EDIT FEATURE' : 'NEW FEATURE'}</div>
            <h1 className={styles.h1}>{formData.title || (isEdit ? 'Editing Feature' : 'Create New Feature')}</h1>
          </div>
          <Link to="/admin" className={styles.backBtn}>Cancel & Exit</Link>
        </header>

        <form onSubmit={handleSubmit} className={styles.form}>
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

          <div className={styles.formFooter}>
            <button type="submit" className={styles.submitBtn}>
              {isEdit ? 'Save Changes' : 'Publish Feature'}
            </button>
            <Link to="/admin" className={styles.secondaryBtn}>Discard Changes</Link>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

export default AdminFeatureFormPage;
