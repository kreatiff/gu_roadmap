import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import { getSections, createSection, updateSection, deleteSection } from '../../../api/sections';
import { useToast } from '../../../contexts/ToastContext';
import styles from './AdminSectionsPage.module.css';

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
    } catch {
      addToast('Failed to create section', 'error');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this section? Features in this section will be marked "No Section".')) return;
    try {
      await deleteSection(id);
      addToast('Section deleted', 'success');
      fetchSections();
    } catch {
      addToast('Failed to delete section', 'error');
    }
  };

  const handleUpdateColor = async (id, color) => {
    try {
      await updateSection(id, { color });
      addToast('Color updated', 'success');
      fetchSections();
    } catch {
      addToast('Failed to update color', 'error');
    }
  };

  return (
    <AdminLayout>
      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <div className={styles.breadcrumb}>ADMIN › CONFIGURATION</div>
            <h1 className={styles.h1}>Section Categories</h1>
          </div>
          <Link to="/admin" className={styles.backBtn}>← Back to Dashboard</Link>
        </header>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Add New Section</h3>
          <form onSubmit={handleCreate} className={styles.formInline}>
            <input 
              type="text" 
              placeholder="e.g. Mobile App, Student Portal..." 
              value={newSection.name}
              onChange={(e) => setNewSection(prev => ({ ...prev, name: e.target.value }))}
              className={styles.input}
              required
            />
            <div className={styles.colorWrapper}>
               <label className={styles.colorLabel}>Accent:</label>
               <input 
                type="color" 
                value={newSection.color}
                onChange={(e) => setNewSection(prev => ({ ...prev, color: e.target.value }))}
                className={styles.colorPicker}
              />
            </div>
            <button type="submit" className={styles.buttonPrimary}>Add Section</button>
          </form>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Existing Sections</h3>
          <div className={styles.listWrapper}>
            {loading ? (
              <div className={styles.message}>Loading sections...</div>
            ) : (
              <div className={styles.grid}>
                {sections.map(s => (
                  <div key={s.id} className={styles.item}>
                    <div className={styles.itemHeader}>
                      <div className={styles.itemColor} style={{ backgroundColor: s.color }}></div>
                      <div className={styles.itemName}>{s.name}</div>
                    </div>
                    <div className={styles.itemActions}>
                      <input 
                        type="color" 
                        value={s.color}
                        onChange={(e) => handleUpdateColor(s.id, e.target.value)}
                        className={styles.colorPickerSmall}
                      />
                      <button onClick={() => handleDelete(s.id)} className={styles.deleteBtn}>
                        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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

export default AdminSectionsPage;
