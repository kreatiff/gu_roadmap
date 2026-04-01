import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import { getFeatures, createFeature, updateFeature } from '../../../api/features';
import { getSections } from '../../../api/sections';
import { useToast } from '../../../contexts/ToastContext';

const AdminFeatureFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const { addToast } = useToast();

  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    section_id: '',
    status: 'under_review',
    pinned: 0,
    tags: []
  });

  useEffect(() => {
    const fetchData = async () => {
      const sData = await getSections();
      setSections(sData);

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
              pinned: feature.pinned,
              tags: typeof feature.tags === 'string' ? JSON.parse(feature.tags) : feature.tags || []
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
      <div style={styles.message}>Loading editor...</div>
    </AdminLayout>
  );

  return (
    <AdminLayout>
      <div style={styles.content}>
        <header style={styles.header}>
          <div>
            <div style={styles.breadcrumb}>ADMIN › {isEdit ? 'EDIT FEATURE' : 'NEW FEATURE'}</div>
            <h1 style={styles.h1}>{formData.title || (isEdit ? 'Editing Feature' : 'Create New Feature')}</h1>
          </div>
          <Link to="/admin" style={styles.backBtn}>Cancel & Exit</Link>
        </header>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Feature Title</label>
            <input 
              type="text" 
              value={formData.title} 
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              style={styles.input}
              placeholder="e.g. Simplified Timetable View"
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Description</label>
            <textarea 
              value={formData.description} 
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              style={{ ...styles.input, height: '180px', resize: 'vertical' }}
              placeholder="Describe the problem this feature solves and who it is for..."
              required
            />
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Current Status</label>
              <select 
                value={formData.status} 
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                style={styles.select}
              >
                <option value="under_review">Under Consideration</option>
                <option value="planned">Planned / Coming Soon</option>
                <option value="in_progress">Active Development</option>
                <option value="launched">Released / Launched</option>
                <option value="declined">Declined</option>
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Application Section</label>
              <select 
                value={formData.section_id} 
                onChange={(e) => setFormData(prev => ({ ...prev, section_id: e.target.value }))}
                style={styles.select}
              >
                <option value="">(No Section Assigned)</option>
                {sections.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Tags (comma-separated)</label>
            <input 
              type="text" 
              value={formData.tags.join(', ')} 
              onChange={handleTagsChange}
              style={styles.input}
              placeholder="UI/UX, Mobile, Student Portal, API..."
            />
          </div>

          <div style={styles.fieldRow}>
            <input 
              type="checkbox" 
              id="pinned"
              checked={formData.pinned === 1} 
              onChange={(e) => setFormData(prev => ({ ...prev, pinned: e.target.checked ? 1 : 0 }))}
              style={styles.checkbox}
            />
            <label htmlFor="pinned" style={styles.checkboxLabel}>Pin feature to top of public roadmap</label>
          </div>

          <div style={styles.formFooter}>
            <button type="submit" style={styles.submitBtn}>
              {isEdit ? 'Save Changes' : 'Publish Feature'}
            </button>
            <Link to="/admin" style={styles.secondaryBtn}>Discard Changes</Link>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
};

const styles = {
  content: { padding: 'var(--space-10) var(--space-8)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-10)' },
  breadcrumb: { fontSize: '0.625rem', fontWeight: '800', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 'var(--space-2)' },
  h1: { fontSize: '2.25rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.04em' },
  backBtn: { color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.875rem', textDecoration: 'none' },
  form: { 
    backgroundColor: '#ffffff', 
    border: '1px solid var(--border-color)', 
    padding: 'var(--space-10) var(--space-8)', 
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-8)',
    maxWidth: '900px'
  },
  field: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1 },
  label: { fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.04em' },
  input: { padding: '12px 14px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '1rem', fontColor: 'var(--text-primary)' },
  select: { padding: '12px 14px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '1rem', backgroundColor: '#fff', color: 'var(--text-primary)', cursor: 'pointer' },
  row: { display: 'flex', gap: 'var(--space-8)' },
  fieldRow: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)' },
  checkbox: { width: '18px', height: '18px', cursor: 'pointer' },
  checkboxLabel: { fontSize: '0.9375rem', fontWeight: '600', color: 'var(--text-primary)', cursor: 'pointer' },
  formFooter: { display: 'flex', alignItems: 'center', gap: 'var(--space-6)', marginTop: 'var(--space-4)', paddingTop: 'var(--space-8)', borderTop: '1px solid var(--border-color)' },
  submitBtn: { backgroundColor: 'var(--gu-red)', color: '#fff', padding: '12px 24px', borderRadius: 'var(--radius-md)', fontWeight: '700', fontSize: '1rem', cursor: 'pointer' },
  secondaryBtn: { color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.9375rem', textDecoration: 'none' },
  message: { padding: 'var(--space-16)', textAlign: 'center', color: 'var(--text-muted)' }
};

export default AdminFeatureFormPage;
