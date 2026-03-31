import { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import Navbar from '../../../components/Navbar';
import { getFeatures, createFeature, updateFeature } from '../../../api/features';
import { getSections } from '../../../api/sections';

const AdminFeatureFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

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
          const fData = await getFeatures();
          const feature = fData.find(f => f.id === id);
          if (feature) {
            setFormData({
              title: feature.title,
              description: feature.description,
              section_id: feature.section_id || '',
              status: feature.status,
              pinned: feature.pinned,
              tags: feature.tags || []
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
      } else {
        await createFeature(formData);
      }
      navigate('/admin');
    } catch (err) {
      alert(err.error || 'Failed to save feature');
    }
  };

  const handleTagsChange = (e) => {
    const tags = e.target.value.split(',').map(tag => tag.trim()).filter(Boolean);
    setFormData(prev => ({ ...prev, tags }));
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div style={styles.page}>
      <Navbar />
      <main className="container" style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.title}>{isEdit ? 'Edit Feature' : 'New Feature'}</h1>
          <Link to="/admin" style={styles.backBtn}>← Back to Dashboard</Link>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Title</label>
            <input 
              type="text" 
              value={formData.title} 
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              style={styles.input}
              required
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Description</label>
            <textarea 
              value={formData.description} 
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              style={{ ...styles.input, height: '150px' }}
              required
            />
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Status</label>
              <select 
                value={formData.status} 
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                style={styles.select}
              >
                <option value="under_review">Under Review</option>
                <option value="planned">Planned</option>
                <option value="in_progress">In Progress</option>
                <option value="launched">Launched</option>
                <option value="declined">Declined</option>
              </select>
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Section</label>
              <select 
                value={formData.section_id} 
                onChange={(e) => setFormData(prev => ({ ...prev, section_id: e.target.value }))}
                style={styles.select}
              >
                <option value="">No Section</option>
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
              placeholder="UI/UX, Performance, Mobile..."
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
            <label htmlFor="pinned" style={styles.checkboxLabel}>Pin to top of roadmap</label>
          </div>

          <div style={styles.actions}>
            <button type="submit" style={styles.submitBtn}>
              {isEdit ? 'Save Changes' : 'Create Feature'}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
};

const styles = {
  page: { minHeight: '100vh', backgroundColor: 'var(--bg-base)' },
  main: { padding: 'var(--space-12) var(--space-6)', display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  title: { fontSize: '2.5rem', color: 'var(--gu-black)' },
  backBtn: { color: 'var(--text-muted)', fontWeight: 'bold' },
  form: { 
    backgroundColor: '#fff', 
    border: '2px solid var(--gu-black)', 
    padding: 'var(--space-8)', 
    boxShadow: 'var(--shadow-md)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-6)',
    maxWidth: '800px'
  },
  field: { display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', flex: 1 },
  label: { fontSize: '0.75rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--gu-black)' },
  input: { padding: 'var(--space-4)', border: '2px solid var(--gu-black)', borderRadius: 'var(--radius-sm)', fontSize: '1rem' },
  select: { padding: 'var(--space-4)', border: '2px solid var(--gu-black)', borderRadius: 'var(--radius-sm)', fontSize: '1rem', backgroundColor: '#fff' },
  row: { display: 'flex', gap: 'var(--space-6)' },
  fieldRow: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' },
  checkboxLabel: { fontSize: '0.9rem', fontWeight: 'bold', color: 'var(--gu-black)' },
  submitBtn: { backgroundColor: 'var(--gu-red)', color: '#fff', padding: '1rem 2rem', fontWeight: 'bold', textTransform: 'uppercase', border: 'none', cursor: 'pointer' }
};

export default AdminFeatureFormPage;
