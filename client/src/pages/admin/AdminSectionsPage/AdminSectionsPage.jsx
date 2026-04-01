import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import { getSections, createSection, updateSection, deleteSection } from '../../../api/sections';
import { useToast } from '../../../contexts/ToastContext';

const AdminSectionsPage = () => {
  const { addToast } = useToast();
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newSection, setNewSection] = useState({ name: '', color: '#e8341c', order_idx: 0 });

  const fetchSections = async () => {
    try {
      const data = await getSections();
      setSections(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSections();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newSection.name) return;
    try {
      await createSection(newSection);
      setNewSection({ name: '', color: '#e8341c', order_idx: sections.length + 1 });
      addToast('Section created successfully', 'success');
      fetchSections();
    } catch (err) {
      addToast('Failed to create section', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this section? Features in this section will be marked "No Section".')) return;
    try {
      await deleteSection(id);
      addToast('Section deleted', 'success');
      fetchSections();
    } catch (err) {
      addToast('Failed to delete section', 'error');
    }
  };

  const handleUpdateColor = async (id, color) => {
    try {
      await updateSection(id, { color });
      addToast('Color updated', 'success');
      fetchSections();
    } catch (err) {
      addToast('Failed to update color', 'error');
    }
  };

  return (
    <AdminLayout>
      <div style={styles.content}>
        <header style={styles.header}>
          <div>
            <div style={styles.breadcrumb}>ADMIN › CONFIGURATION</div>
            <h1 style={styles.h1}>Section Categories</h1>
          </div>
          <Link to="/admin" style={styles.backBtn}>← Back to Dashboard</Link>
        </header>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Add New Section</h3>
          <form onSubmit={handleCreate} style={styles.formInline}>
            <input 
              type="text" 
              placeholder="e.g. Mobile App, Student Portal..." 
              value={newSection.name}
              onChange={(e) => setNewSection(prev => ({ ...prev, name: e.target.value }))}
              style={styles.input}
              required
            />
            <div style={styles.colorWrapper}>
               <label style={styles.colorLabel}>Accent:</label>
               <input 
                type="color" 
                value={newSection.color}
                onChange={(e) => setNewSection(prev => ({ ...prev, color: e.target.value }))}
                style={styles.colorPicker}
              />
            </div>
            <button type="submit" style={styles.buttonPrimary}>Add Section</button>
          </form>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Existing Sections</h3>
          <div style={styles.listWrapper}>
            {loading ? (
              <div style={styles.message}>Loading sections...</div>
            ) : (
              <div style={styles.grid}>
                {sections.map(s => (
                  <div key={s.id} style={styles.item}>
                    <div style={styles.itemHeader}>
                      <div style={{ ...styles.itemColor, backgroundColor: s.color }}></div>
                      <div style={styles.itemName}>{s.name}</div>
                    </div>
                    <div style={styles.itemActions}>
                      <input 
                        type="color" 
                        value={s.color}
                        onChange={(e) => handleUpdateColor(s.id, e.target.value)}
                        style={styles.colorPickerSmall}
                      />
                      <button onClick={() => handleDelete(s.id)} style={styles.deleteBtn}>
                        <svg style={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                           <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
};

const styles = {
  content: { padding: 'var(--space-10) var(--space-8)' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-10)' },
  breadcrumb: { fontSize: '0.625rem', fontWeight: '700', color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 'var(--space-2)' },
  h1: { fontSize: '2.25rem', fontWeight: '800', color: 'var(--text-primary)', letterSpacing: '-0.04em' },
  backBtn: { color: 'var(--text-secondary)', fontWeight: '600', fontSize: '0.875rem', textDecoration: 'none' },
  section: { marginBottom: 'var(--space-12)' },
  sectionTitle: { fontSize: '0.875rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 'var(--space-4)', letterSpacing: '0.05em' },
  formInline: { 
    display: 'flex', 
    alignItems: 'center',
    gap: 'var(--space-4)', 
    backgroundColor: '#fff', 
    border: '1px solid var(--border-color)', 
    padding: 'var(--space-4)', 
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)'
  },
  input: { flex: 1, padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', fontSize: '0.9375rem' },
  colorWrapper: { display: 'flex', alignItems: 'center', gap: 'var(--space-2)' },
  colorLabel: { fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)' },
  colorPicker: { width: '40px', height: '40px', padding: 0, border: '1px solid var(--border-color)', borderRadius: '4px', cursor: 'pointer', overflow: 'hidden' },
  buttonPrimary: { backgroundColor: 'var(--gu-red)', color: '#fff', padding: '10px 20px', borderRadius: 'var(--radius-md)', fontWeight: '700', fontSize: '0.875rem' },
  listWrapper: { marginTop: 'var(--space-2)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 'var(--space-4)' },
  item: { 
    backgroundColor: '#fff', 
    border: '1px solid var(--border-color)', 
    padding: 'var(--space-4)', 
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    transition: 'transform 0.15s ease'
  },
  itemHeader: { display: 'flex', alignItems: 'center', gap: 'var(--space-4)' },
  itemColor: { width: '8px', height: '8px', borderRadius: '50%' },
  itemName: { fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)' },
  itemActions: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)' },
  colorPickerSmall: { width: '24px', height: '24px', border: 'none', background: 'none', cursor: 'pointer', outline: 'none' },
  deleteBtn: { color: 'var(--text-muted)', cursor: 'pointer' },
  icon: { width: '18px', height: '18px' },
  message: { padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }
};

export default AdminSectionsPage;
