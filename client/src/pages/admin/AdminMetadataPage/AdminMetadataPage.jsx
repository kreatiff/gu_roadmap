import { useEffect, useState } from 'react';
import AdminLayout from '../../../components/AdminLayout';
import { getMetadata, renameMetadata, deleteMetadata } from '../../../api/metadata';
import { useToast } from '../../../contexts/ToastContext';
import styles from './AdminMetadataPage.module.css';

const TABS = [
  { key: 'tags', label: 'Tags', singular: 'Tag' },
  { key: 'owners', label: 'Owners', singular: 'Owner' },
  { key: 'stakeholders', label: 'Stakeholders', singular: 'Stakeholder' }
];

const AdminMetadataPage = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState('tags');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [renameModal, setRenameModal] = useState({ isOpen: false, item: null, newValue: '' });
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, item: null });

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await getMetadata(activeTab);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      addToast(err.error || `Failed to load ${activeTab}`, 'error');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const data = await getMetadata(activeTab);
        if (!cancelled) {
          setItems(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          addToast(err.error || `Failed to load ${activeTab}`, 'error');
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    run();
    return () => { cancelled = true; };
  }, [activeTab]);

  const handleRename = async (e) => {
    e.preventDefault();
    if (!renameModal.newValue.trim()) {
      addToast('New value cannot be empty', 'error');
      return;
    }
    try {
      const result = await renameMetadata(activeTab, renameModal.item.value, renameModal.newValue.trim());
      if (result.failures?.length > 0) {
        if (result.updatedCount === 0) {
          addToast('Rename failed for all features', 'error');
        } else {
          addToast(`Renamed ${result.updatedCount} features, but ${result.failures.length} failed`, 'warning');
        }
      } else {
        addToast(`Renamed "${renameModal.item.value}" to "${renameModal.newValue.trim()}"`, 'success');
      }
      setRenameModal({ isOpen: false, item: null, newValue: '' });
      await fetchItems();
    } catch (err) {
      addToast(err.error || 'Rename failed', 'error');
    }
  };

  const handleDelete = async () => {
    try {
      const result = await deleteMetadata(activeTab, deleteModal.item.value);
      if (result.failures?.length > 0) {
        if (result.updatedCount === 0) {
          addToast('Delete failed for all features', 'error');
        } else {
          addToast(`Deleted from ${result.updatedCount} features, but ${result.failures.length} failed`, 'warning');
        }
      } else {
        addToast(`Deleted "${deleteModal.item.value}" from ${deleteModal.item.usageCount} feature(s)`, 'success');
      }
      setDeleteModal({ isOpen: false, item: null });
      await fetchItems();
    } catch (err) {
      addToast(err.error || 'Delete failed', 'error');
    }
  };

  const openRename = (item) => {
    setRenameModal({ isOpen: true, item, newValue: item.value });
  };

  const openDelete = (item) => {
    setDeleteModal({ isOpen: true, item });
  };

  return (
    <AdminLayout>
      <div className={styles.container}>
        <header className={styles.header}>
          <h1 className={styles.title}>Metadata</h1>
          <p className={styles.subtitle}>Manage tags, owners, and stakeholders used across all features</p>
        </header>

        <div className={styles.tabs}>
          {TABS.map(tab => (
            <button
              key={tab.key}
              className={activeTab === tab.key ? styles.tabActive : styles.tab}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              {TABS.find(t => t.key === activeTab)?.label}
            </h3>
            {!loading && (
              <span className={styles.count}>{items.length} value{items.length !== 1 ? 's' : ''}</span>
            )}
          </div>

          {loading ? (
            <div className={styles.loading}>Loading...</div>
          ) : items.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>No {activeTab} found</p>
              <p className={styles.emptyDesc}>Values are created automatically when you edit features.</p>
            </div>
          ) : (
            <div className={styles.tableWrapper}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Value</th>
                    <th>Usage</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.value}>
                      <td className={styles.valueCell} title={item.value}>{item.value}</td>
                      <td className={styles.countCell}>{item.usageCount}</td>
                      <td className={styles.actionsCell}>
                        <button className={styles.btnRename} onClick={() => openRename(item)}>
                          Rename
                        </button>
                        <button className={styles.btnDelete} onClick={() => openDelete(item)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Rename Modal */}
        {renameModal.isOpen && (
          <div className={styles.modalOverlay} onClick={() => setRenameModal({ isOpen: false, item: null, newValue: '' })}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Rename {TABS.find(t => t.key === activeTab)?.singular}</h3>
              </div>
              <form onSubmit={handleRename}>
                <div className={styles.modalBody}>
                  <div className={styles.field}>
                    <label className={styles.label}>Current value</label>
                    <input type="text" value={renameModal.item?.value || ''} readOnly className={styles.input} style={{ background: 'var(--bg-secondary)', color: 'var(--text-muted)' }} />
                  </div>
                  <div className={styles.field}>
                    <label className={styles.label}>New value</label>
                    <input
                      type="text"
                      value={renameModal.newValue}
                      onChange={e => setRenameModal(prev => ({ ...prev, newValue: e.target.value }))}
                      className={styles.input}
                      placeholder="Enter new value"
                      autoFocus
                    />
                  </div>
                </div>
                <div className={styles.modalFooter}>
                  <button type="button" className={styles.btnSecondary} onClick={() => setRenameModal({ isOpen: false, item: null, newValue: '' })}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.btnPrimary}>Rename</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirm Modal */}
        {deleteModal.isOpen && (
          <div className={styles.modalOverlay} onClick={() => setDeleteModal({ isOpen: false, item: null })}>
            <div className={styles.modal} onClick={e => e.stopPropagation()}>
              <div className={styles.modalHeader}>
                <h3 className={styles.modalTitle}>Delete {TABS.find(t => t.key === activeTab)?.singular}</h3>
              </div>
              <div className={styles.modalBody}>
                <p className={styles.warningText}>
                  Are you sure you want to delete <strong>"{deleteModal.item?.value}"</strong>?
                </p>
                <p className={styles.warningText} style={{ marginTop: 8 }}>
                  This value is used by <span className={styles.warningHighlight}>{deleteModal.item?.usageCount} feature(s)</span>.
                  Deleting it will remove it from all features. This action cannot be undone.
                </p>
              </div>
              <div className={styles.modalFooter}>
                <button className={styles.btnSecondary} onClick={() => setDeleteModal({ isOpen: false, item: null })}>
                  Cancel
                </button>
                <button className={styles.btnDanger} onClick={handleDelete}>
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminMetadataPage;
