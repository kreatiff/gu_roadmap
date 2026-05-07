import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import ConfirmDialog from '../../../components/ConfirmDialog';
import DashboardFormModal from '../../../components/DashboardFormModal/DashboardFormModal';
import { getDashboards, createDashboard, updateDashboard, deleteDashboard } from '../../../api/dashboards';
import { getFeatureTags } from '../../../api/features';
import { getCategories } from '../../../api/categories';
import { getStages } from '../../../api/stages';
import { useToast } from '../../../contexts/ToastContext';
import styles from './AdminDashboardsPage.module.css';

const AdminDashboardsPage = () => {
  const { addToast } = useToast();
  const [dashboards, setDashboards] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stages, setStages] = useState([]);
  const [availableTags, setAvailableTags] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [lastCreated, setLastCreated] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState(null);

  const [deletingId, setDeletingId] = useState(null);
  const [deleteDialog, setDeleteDialog] = useState({ isOpen: false, id: null });

  const fetchData = async () => {
    try {
      const [dData, cData, sData, tData] = await Promise.all([
        getDashboards(),
        getCategories(),
        getStages(),
        getFeatureTags()
      ]);
      setDashboards(dData);
      setCategories(cData);
      setStages(sData);
      setAvailableTags(tData);
    } catch (err) {
      console.error('Failed to fetch data:', err);
      addToast('Failed to load dashboards', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreate = () => {
    setEditingDashboard(null);
    setIsModalOpen(true);
    setLastCreated(null);
  };

  const handleEdit = (dashboard) => {
    setEditingDashboard(dashboard);
    setIsModalOpen(true);
    setLastCreated(null);
  };

  const handleModalClose = () => {
    setIsModalOpen(false);
    setEditingDashboard(null);
  };

  const handleModalSubmit = async (payload) => {
    if (editingDashboard) {
      await updateDashboard(editingDashboard.id, payload);
      addToast('Dashboard updated successfully', 'success');
      setIsModalOpen(false);
      setEditingDashboard(null);
      fetchData();
    } else {
      const result = await createDashboard(payload);
      addToast('Dashboard created successfully', 'success');
      setIsModalOpen(false);
      setLastCreated(result);
      fetchData();
    }
  };

  const requestDelete = (id) => {
    setDeleteDialog({ isOpen: true, id });
  };

  const executeDelete = async () => {
    const id = deleteDialog.id;
    if (!id) return;
    try {
      setDeletingId(id);
      setDeleteDialog({ isOpen: false, id: null });
      await deleteDashboard(id);
      addToast('Dashboard deleted successfully', 'success');
      await fetchData();
    } catch (err) {
      console.error('Delete error:', err);
      addToast(err.error || 'Failed to delete dashboard', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  const copyToClipboard = (slug) => {
    const url = `${window.location.origin}/d/${slug}`;
    navigator.clipboard.writeText(url);
    addToast('URL copied to clipboard', 'success');
  };

  return (
    <AdminLayout>
      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <div className={styles.breadcrumb}>ADMIN › CONFIGURATION</div>
            <h1 className={styles.h1}>Public Dashboards</h1>
          </div>
          <div className={styles.headerActions}>
            <button onClick={handleCreate} className={styles.createBtn}>
              <svg className={styles.createIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              Create Dashboard
            </button>
            <Link to="/admin" className={styles.backBtn}>← Back to Dashboard</Link>
          </div>
        </header>

        {lastCreated && (
          <div className={styles.urlBanner}>
            <div className={styles.bannerContent}>
              <div className={styles.bannerIcon}>🔗</div>
              <div className={styles.bannerText}>
                <strong>Dashboard Ready:</strong> {window.location.origin}/d/{lastCreated.slug}
                {lastCreated.is_protected && <span className={styles.protectedBadge}>🔒 Password Protected</span>}
              </div>
            </div>
            <button 
              onClick={() => copyToClipboard(lastCreated.slug)} 
              className={styles.bannerBtn}
            >
              Copy URL
            </button>
          </div>
        )}

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Active Dashboards</h3>
          <div className={styles.listWrapper}>
            {loading ? (
              <div className={styles.message}>Loading dashboards...</div>
            ) : dashboards.length === 0 ? (
              <div className={styles.emptyState}>
                <div className={styles.emptyIcon}>📊</div>
                <p className={styles.emptyTitle}>No dashboards yet</p>
                <p className={styles.emptyDesc}>Create your first dashboard preset to share a filtered roadmap view.</p>
                <button onClick={handleCreate} className={styles.buttonPrimary}>Create Dashboard</button>
              </div>
            ) : (
              <div className={styles.tableWrapper}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th className={styles.th}>Name</th>
                      <th className={styles.th}>Active Filters</th>
                      <th className={`${styles.th} ${styles.thCenter} ${styles.thProtected}`}>Protected</th>
                      <th className={`${styles.th} ${styles.thCreatedBy}`}>Created By</th>
                      <th className={`${styles.th} ${styles.thRight} ${styles.thActions}`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dashboards.map((d) => (
                      <tr key={d.id} className={styles.tr}>
                         <td className={styles.td}>
                           <a 
                             href={`/d/${d.slug}`} 
                             target="_blank" 
                             rel="noopener noreferrer"
                             className={styles.dashboardLink}
                           >
                             <div className={styles.dashboardName}>{d.name}</div>
                             <div className={styles.dashboardSlug}>/d/{d.slug}</div>
                           </a>
                         </td>
                         <td className={styles.td}>
                           <div className={styles.filterList}>
                             {d.filters.tags?.length > 0 && (
                               <span className={styles.filterPill}>Tags: {d.filters.tags.join(', ')}</span>
                             )}
                             {(d.filters.category_ids?.length > 0 || d.filters.category_id) && (
                               <span className={styles.filterPill}>
                                 Categories: {(
                                   d.filters.category_ids || [d.filters.category_id]
                                 ).map(id => categories.find(c => c.id === id)?.name || id).join(', ')}
                               </span>
                             )}
                             {(d.filters.stage_slugs?.length > 0 || d.filters.stage_slug) && (
                               <span className={styles.filterPill}>
                                 Stages: {(
                                   d.filters.stage_slugs || [d.filters.stage_slug]
                                 ).map(slug => stages.find(s => s.slug === slug)?.name || slug).join(', ')}
                               </span>
                             )}
                             {(!d.filters.tags?.length && !d.filters.category_ids?.length && !d.filters.category_id && !d.filters.stage_slugs?.length && !d.filters.stage_slug) && (
                               <span className={styles.noFilters}>No filters applied</span>
                             )}
                           </div>
                         </td>
                         <td className={`${styles.td} ${styles.tdCenter}`}>
                           {d.is_protected ? (
                             <span className={styles.iconLock} title="Password protected">🔒</span>
                           ) : (
                             <span className={styles.iconUnlock} title="Public access">🔓</span>
                           )}
                         </td>
                         <td className={styles.td}>
                           <div className={styles.createdBy}>{d.created_by.split('@')[0]}</div>
                         </td>
                         <td className={`${styles.td} ${styles.tdRight}`}>
                          <div className={styles.actions}>
                            <button 
                              onClick={() => handleEdit(d)} 
                              className={styles.editBtn} 
                              title="Edit dashboard"
                            >
                              <svg className={styles.iconSmall} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                              </svg>
                            </button>
                            <button 
                              onClick={() => copyToClipboard(d.slug)} 
                              className={styles.copyBtn} 
                              title="Copy Public URL"
                            >
                              <svg className={styles.iconSmall} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <path d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                              </svg>
                            </button>
                            <button
                              onClick={() => requestDelete(d.id)}
                              className={styles.deleteBtn}
                              title="Delete dashboard"
                              disabled={deletingId === d.id}
                            >
                              {deletingId === d.id ? (
                                <div className={styles.spinnerSmall}></div>
                              ) : (
                                <svg className={styles.iconSmall} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                </svg>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </div>

      {deleteDialog.isOpen && (
        <ConfirmDialog
          title="Delete Dashboard?"
          message="Are you sure you want to delete this dashboard? This action cannot be undone and the URL will stop working immediately."
          confirmText="Delete Dashboard"
          onConfirm={executeDelete}
          onCancel={() => setDeleteDialog({ isOpen: false, id: null })}
          isLoading={deletingId === deleteDialog.id}
        />
      )}

      <DashboardFormModal
        isOpen={isModalOpen}
        onClose={handleModalClose}
        onSubmit={handleModalSubmit}
        dashboard={editingDashboard}
        categories={categories}
        stages={stages}
        availableTags={availableTags}
      />
    </AdminLayout>
  );
};

export default AdminDashboardsPage;
