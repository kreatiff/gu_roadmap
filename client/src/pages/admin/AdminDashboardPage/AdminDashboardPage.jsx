import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../../../components/Navbar';
import StatusBadge from '../../../components/StatusBadge';
import { getFeatures, deleteFeature, updateFeature } from '../../../api/features';

const AdminDashboardPage = () => {
  const [features, setFeatures] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFeatures = async () => {
    try {
      const data = await getFeatures();
      setFeatures(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFeatures();
  }, []);

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this feature? This action cannot be undone.')) return;
    try {
      await deleteFeature(id);
      fetchFeatures();
    } catch (err) {
      alert('Failed to delete feature');
    }
  };

  const togglePinned = async (feature) => {
    try {
      await updateFeature(feature.id, { pinned: feature.pinned === 1 ? 0 : 1 });
      fetchFeatures();
    } catch (err) {
      alert('Failed to update pinned status');
    }
  };

  return (
    <div style={styles.page}>
      <Navbar />
      
      <main className="container" style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.title}>Feature Management</h1>
          <div style={styles.actions}>
            <Link to="/admin/sections" style={styles.buttonSecondary}>Manage Sections</Link>
            <Link to="/admin/features/new" style={styles.buttonPrimary}>+ New Feature</Link>
          </div>
        </div>

        <div style={styles.tableWrapper}>
          {loading ? (
            <div style={styles.message}>Loading features...</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Pinned</th>
                  <th style={styles.th}>Title</th>
                  <th style={styles.th}>Section</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Votes</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {features.map(f => (
                  <tr key={f.id} style={styles.tr}>
                    <td style={styles.td}>
                      <button onClick={() => togglePinned(f)} style={styles.pinBtn}>
                        {f.pinned === 1 ? '★' : '☆'}
                      </button>
                    </td>
                    <td style={styles.td}>
                      <div style={styles.featureTitle}>{f.title}</div>
                      <div style={styles.featureSlug}>{f.slug}</div>
                    </td>
                    <td style={styles.td}>
                      <span style={{ ...styles.sectionBadge, backgroundColor: f.section_color || '#ccc' }}>
                        {f.section_name || 'No Section'}
                      </span>
                    </td>
                    <td style={styles.td}><StatusBadge status={f.status} /></td>
                    <td style={styles.td}>{f.vote_count}</td>
                    <td style={styles.td}>
                      <div style={styles.btnGroup}>
                        <Link to={`/admin/features/${f.id}/edit`} style={styles.editBtn}>Edit</Link>
                        <button onClick={() => handleDelete(f.id)} style={styles.deleteBtn}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
};

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-base)',
    color: 'var(--text-primary)'
  },
  main: {
    padding: 'var(--space-12) var(--space-6)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-8)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  title: {
    fontSize: '2.5rem',
    color: 'var(--gu-black)'
  },
  actions: {
    display: 'flex',
    gap: 'var(--space-4)'
  },
  tableWrapper: {
    backgroundColor: '#fff',
    border: '2px solid var(--gu-black)',
    boxShadow: 'var(--shadow-md)',
    overflowX: 'auto'
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left'
  },
  th: {
    padding: '1rem',
    borderBottom: '2px solid var(--gu-black)',
    backgroundColor: 'var(--gu-black)',
    color: '#fff',
    textTransform: 'uppercase',
    fontSize: '0.75rem',
    fontWeight: 'bold'
  },
  tr: {
    borderBottom: '1px solid var(--border-color)'
  },
  td: {
    padding: '1rem',
    fontSize: '0.9rem'
  },
  featureTitle: {
    fontWeight: 'bold',
    color: 'var(--gu-black)'
  },
  featureSlug: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
  },
  sectionBadge: {
    padding: '2px 8px',
    color: '#fff',
    fontSize: '0.65rem',
    fontWeight: 'bold',
    textTransform: 'uppercase'
  },
  pinBtn: {
    fontSize: '1.25rem',
    color: 'var(--gu-gold)'
  },
  btnGroup: {
    display: 'flex',
    gap: 'var(--space-4)'
  },
  editBtn: {
    color: 'var(--gu-red)',
    fontWeight: 'bold',
    fontSize: '0.8rem',
    textTransform: 'uppercase'
  },
  deleteBtn: {
    color: 'var(--text-muted)',
    fontWeight: 'bold',
    fontSize: '0.8rem',
    textTransform: 'uppercase'
  },
  buttonPrimary: {
    backgroundColor: 'var(--gu-red)',
    color: '#fff',
    padding: '0.5rem 1rem',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    border: '2px solid transparent'
  },
  buttonSecondary: {
    color: 'var(--gu-black)',
    padding: '0.5rem 1rem',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    border: '2px solid var(--gu-black)'
  },
  message: {
    padding: '4rem',
    textAlign: 'center',
    color: 'var(--text-muted)'
  }
};

export default AdminDashboardPage;
