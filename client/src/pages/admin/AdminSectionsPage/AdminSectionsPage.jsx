import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../../components/Navbar';
import { getSections, createSection, updateSection, deleteSection } from '../../../api/sections';

const AdminSectionsPage = () => {
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
      fetchSections();
    } catch (err) {
      alert('Failed to create section');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this section? Features in this section will be marked "No Section".')) return;
    try {
      await deleteSection(id);
      fetchSections();
    } catch (err) {
      alert('Failed to delete section');
    }
  };

  const handleUpdateColor = async (id, color) => {
    try {
      await updateSection(id, { color });
      fetchSections();
    } catch (err) {
      alert('Failed to update color');
    }
  };

  return (
    <div style={styles.page}>
      <Navbar />
      <main className="container" style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.title}>Section Categories</h1>
          <Link to="/admin" style={styles.backBtn}>← Back to Dashboard</Link>
        </div>

        {/* 1. Create Section Form */}
        <form onSubmit={handleCreate} style={styles.formInline}>
          <input 
            type="text" 
            placeholder="New Section Name..." 
            value={newSection.name}
            onChange={(e) => setNewSection(prev => ({ ...prev, name: e.target.value }))}
            style={styles.input}
            required
          />
          <input 
            type="color" 
            value={newSection.color}
            onChange={(e) => setNewSection(prev => ({ ...prev, color: e.target.value }))}
            style={styles.colorPicker}
          />
          <button type="submit" style={styles.buttonPrimary}>Add Section</button>
        </form>

        {/* 2. Sections List */}
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
                    <button onClick={() => handleDelete(s.id)} style={styles.deleteBtn}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
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
  formInline: { 
    display: 'flex', 
    gap: 'var(--space-4)', 
    backgroundColor: '#fff', 
    border: '2px solid var(--gu-black)', 
    padding: 'var(--space-4)', 
    boxShadow: 'var(--shadow-md)' 
  },
  input: { flex: 1, padding: 'var(--space-3)', border: '2px solid var(--gu-black)', borderRadius: 'var(--radius-sm)' },
  colorPicker: { width: '50px', height: '100%', padding: 0, border: '2px solid var(--gu-black)', cursor: 'pointer' },
  buttonPrimary: { backgroundColor: 'var(--gu-red)', color: '#fff', padding: '0.5rem 1rem', textTransform: 'uppercase', fontWeight: 'bold', border: 'none', cursor: 'pointer' },
  listWrapper: { marginTop: 'var(--space-4)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 'var(--space-6)' },
  item: { 
    backgroundColor: '#fff', 
    border: '2px solid var(--gu-black)', 
    padding: 'var(--space-4)', 
    boxShadow: 'var(--shadow-md)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  itemHeader: { display: 'flex', alignItems: 'center', gap: 'var(--space-4)' },
  itemColor: { width: '12px', height: '12px' },
  itemName: { fontWeight: 'bold', fontSize: '1.1rem', color: 'var(--gu-black)' },
  itemActions: { display: 'flex', alignItems: 'center', gap: 'var(--space-4)' },
  colorPickerSmall: { width: '25px', height: '25px', border: 'none', background: 'none', cursor: 'pointer' },
  deleteBtn: { color: 'var(--text-muted)', fontWeight: 'bold', fontSize: '0.75rem', textTransform: 'uppercase' },
  message: { padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }
};

export default AdminSectionsPage;
