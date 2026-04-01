import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import { getStages, createStage, updateStage, deleteStage } from '../../../api/stages';
import { useToast } from '../../../contexts/ToastContext';

const AdminStagesPage = () => {
  const { addToast } = useToast();
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newStage, setNewStage] = useState({ name: '', color: '#64748b', order_idx: 0 });
  
  // Deletion state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [stageToDelete, setStageToDelete] = useState(null);
  const [reassignTo, setReassignTo] = useState('');

  const fetchStages = async () => {
    try {
      const data = await getStages();
      setStages(data);
      if (data.length > 0) setReassignTo(data[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStages();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newStage.name) return;
    try {
      await createStage({ ...newStage, order_idx: stages.length });
      setNewStage({ name: '', color: '#64748b', order_idx: stages.length + 1 });
      addToast('Stage created successfully', 'success');
      fetchStages();
    } catch (err) {
      addToast('Failed to create stage', 'error');
    }
  };

  const handleDeleteAttempt = async (stage) => {
    try {
      // First try deleting without reassignment to check for conflicts
      await deleteStage(stage.id);
      addToast('Stage deleted', 'success');
      fetchStages();
    } catch (err) {
      if (err.status === 409) {
        // Conflict detected, features are orphaned
        setStageToDelete(stage);
        setShowDeleteModal(true);
        // Default reassignment target should not be the one being deleted
        const firstOther = stages.find(s => s.id !== stage.id);
        if (firstOther) setReassignTo(firstOther.id);
      } else {
        addToast('Failed to delete stage', 'error');
      }
    }
  };

  const handleConfirmDeleteWithReassign = async () => {
    try {
      await deleteStage(stageToDelete.id, reassignTo);
      addToast('Stage deleted and features moved', 'success');
      setShowDeleteModal(false);
      setStageToDelete(null);
      fetchStages();
    } catch (err) {
      addToast('Deletion failed', 'error');
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await updateStage(id, data);
      addToast('Stage updated', 'success');
      fetchStages();
    } catch (err) {
      addToast('Update failed', 'error');
    }
  };

  return (
    <AdminLayout>
      <div style={styles.content}>
        <header style={styles.header}>
          <div>
            <div style={styles.breadcrumb}>ADMIN › CONFIGURATION</div>
            <h1 style={styles.h1}>Roadmap Stages</h1>
          </div>
          <Link to="/admin" style={styles.backBtn}>← Back to Dashboard</Link>
        </header>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Add New Stage</h3>
          <form onSubmit={handleCreate} style={styles.formInline}>
            <input 
              type="text" 
              placeholder="e.g. Backlog, Testing, Beta..." 
              value={newStage.name}
              onChange={(e) => setNewStage(prev => ({ ...prev, name: e.target.value }))}
              style={styles.input}
              required
            />
            <div style={styles.colorWrapper}>
               <label style={styles.colorLabel}>Theme:</label>
               <input 
                type="color" 
                value={newStage.color}
                onChange={(e) => setNewStage(prev => ({ ...prev, color: e.target.value }))}
                style={styles.colorPicker}
              />
            </div>
            <button type="submit" style={styles.buttonPrimary}>Add Stage</button>
          </form>
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Workflow Pipeline</h3>
          <div style={styles.listWrapper}>
            {loading ? (
              <div style={styles.message}>Loading stages...</div>
            ) : (
              <div style={styles.grid}>
                {stages.map(s => (
                  <div key={s.id} style={styles.item}>
                    <div style={styles.itemHeader}>
                      <div style={{ ...styles.itemColor, backgroundColor: s.color }}></div>
                      <input 
                        style={styles.itemNameInput} 
                        value={s.name} 
                        onChange={(e) => handleUpdate(s.id, { name: e.target.value })}
                        onBlur={() => fetchStages()} // Sync on blur
                      />
                    </div>
                    <div style={styles.itemActions}>
                      <div style={styles.orderLabel}>Order:</div>
                      <input 
                        type="number"
                        style={styles.orderInput}
                        value={s.order_idx}
                        onChange={(e) => handleUpdate(s.id, { order_idx: parseInt(e.target.value) })}
                      />
                      <input 
                        type="color" 
                        value={s.color}
                        onChange={(e) => handleUpdate(s.id, { color: e.target.value })}
                        style={styles.colorPickerSmall}
                      />
                      <button onClick={() => handleDeleteAttempt(s)} style={styles.deleteBtn}>
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

        {/* Delete Reassignment Modal */}
        {showDeleteModal && (
          <div style={styles.modalOverlay}>
            <div style={styles.modal}>
              <h3 style={styles.modalTitle}>Safe Stage Deletion</h3>
              <p style={styles.modalText}>
                The stage <strong>{stageToDelete?.name}</strong> has features assigned to it. 
                Where should these features be moved?
              </p>
              <select 
                style={styles.modalSelect} 
                value={reassignTo} 
                onChange={(e) => setReassignTo(e.target.value)}
              >
                {stages.filter(s => s.id !== stageToDelete?.id).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div style={styles.modalActions}>
                <button onClick={() => setShowDeleteModal(false)} style={styles.cancelBtn}>Cancel</button>
                <button onClick={handleConfirmDeleteWithReassign} style={styles.confirmDeleteBtn}>Migrate & Delete</button>
              </div>
            </div>
          </div>
        )}
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 'var(--space-4)' },
  item: { 
    backgroundColor: '#fff', 
    border: '1px solid var(--border-color)', 
    padding: 'var(--space-4)', 
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  itemHeader: { display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flex: 1 },
  itemColor: { width: '12px', height: '12px', borderRadius: '50%' },
  itemNameInput: { fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)', border: 'none', background: 'none', outline: 'none', padding: '2px 4px', flex: 1 },
  itemActions: { display: 'flex', alignItems: 'center', gap: 'var(--space-3)' },
  orderLabel: { fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' },
  orderInput: { width: '50px', padding: '4px', border: '1px solid var(--border-color)', borderRadius: '4px', fontSize: '0.875rem' },
  colorPickerSmall: { width: '24px', height: '24px', border: 'none', background: 'none', cursor: 'pointer', outline: 'none' },
  deleteBtn: { color: 'var(--text-muted)', cursor: 'pointer' },
  icon: { width: '18px', height: '18px' },
  message: { padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' },
  
  // Modal Styles
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: '#fff', padding: 'var(--space-8)', borderRadius: 'var(--radius-xl)', maxWidth: '400px', width: '90%', boxShadow: 'var(--shadow-2xl)' },
  modalTitle: { fontSize: '1.25rem', fontWeight: '800', marginBottom: 'var(--space-4)' },
  modalText: { color: 'var(--text-secondary)', marginBottom: 'var(--space-6)', lineHeight: '1.5' },
  modalSelect: { width: '100%', padding: '12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', marginBottom: 'var(--space-8)', fontSize: '1rem' },
  modalActions: { display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-4)' },
  cancelBtn: { padding: '10px 16px', borderRadius: 'var(--radius-md)', fontWeight: '600', color: 'var(--text-secondary)' },
  confirmDeleteBtn: { padding: '10px 16px', borderRadius: 'var(--radius-md)', fontWeight: '700', backgroundColor: 'var(--gu-red)', color: '#fff' }
};

export default AdminStagesPage;
