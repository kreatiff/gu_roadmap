import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import { getFeatures, createFeature, updateFeature } from '../../../api/features';
import { getSections } from '../../../api/sections';
import { getStages } from '../../../api/stages';
import { useToast } from '../../../contexts/ToastContext';
import styles from './AdminFeatureFormPage.module.css';

const AdminFeatureFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { addToast } = useToast();

  const [sections, setSections] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    section_id: '',
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
      const [sData, stData] = await Promise.all([
        getSections(),
        getStages()
      ]);
      setSections(sData);
      setStages(stData);

      if (isEdit) {
        try {
          const res = await getFeatures({ limit: 1000 });
          const fData = res.data || [];
          const feature = fData.find(f => f.id === id);
          if (feature) {
            setFormData({
              title: feature.title,
              description: feature.description,
              section_id: feature.section_id || '',
              status: feature.status,
              stage_id: feature.stage_id || '',
              pinned: feature.pinned,
              tags: typeof feature.tags === 'string' ? JSON.parse(feature.tags) : feature.tags || [],
              impact: feature.impact || 1,
              effort: feature.effort || 1,
              owner: feature.owner || '',
              key_stakeholder: feature.key_stakeholder || '',
              priority: feature.priority || 'Medium'
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
            <textarea 
              value={formData.description} 
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className={styles.input}
              style={{ height: '180px', resize: 'vertical' }}
              placeholder="Describe the problem this feature solves and who it is for..."
              required
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
              <label className={styles.label}>Application Section</label>
              <select 
                value={formData.section_id} 
                onChange={(e) => setFormData(prev => ({ ...prev, section_id: e.target.value }))}
                className={styles.select}
              >
                <option value="">(No Section Assigned)</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
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

          <div className={styles.sectionDivider}>Strategic Internal Data (Admin Only)</div>

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
