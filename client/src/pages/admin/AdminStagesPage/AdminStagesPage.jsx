import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { GripVertical, Eye, EyeOff, Trash2, Ban } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import AdminLayout from '../../../components/AdminLayout';
import ReassignDialog from '../../../components/ReassignDialog';
import { getStages, createStage, updateStage, deleteStage, reorderStages } from '../../../api/stages';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import styles from './AdminStagesPage.module.css';

const AdminStagesPage = () => {
  const { addToast } = useToast();
  const { isSuperAdmin } = useAuth();
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newStage, setNewStage] = useState({ name: '', color: '#64748b', order_idx: 0, is_visible: true });
  
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
      setNewStage({ name: '', color: '#64748b', order_idx: stages.length + 1, is_visible: true });
      addToast('Stage created successfully', 'success');
      fetchStages();
    } catch {
      addToast('Failed to create stage', 'error');
    }
  };

  const handleDeleteAttempt = async (stage) => {
    try {
      await deleteStage(stage.id);
      addToast('Stage deleted', 'success');
      fetchStages();
    } catch (err) {
      if (err.status === 409) {
        setStageToDelete(stage);
        setShowDeleteModal(true);
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
    } catch {
      addToast('Deletion failed', 'error');
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      setStages(prev => prev.map(s => s.id === id ? { ...s, ...data } : s));
      await updateStage(id, data);
    } catch {
      addToast('Failed to update stage', 'error');
      fetchStages();
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const reordered = Array.from(stages);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);

    setStages(reordered);
    
    try {
      await reorderStages(reordered.map(s => s.id));
      addToast('Order updated', 'success');
      fetchStages();
    } catch {
      addToast('Failed to reorder stages', 'error');
      fetchStages();
    }
  };

  return (
    <AdminLayout>
      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.h1}>Roadmap Stages</h1>
          </div>
          <Link to="/admin" className={styles.backBtn}>← Back to Dashboard</Link>
        </header>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Add New Stage</h3>
          <form onSubmit={handleCreate} className={styles.formInline}>
            <input 
              type="text" 
              placeholder="e.g. Backlog, Testing, Beta..." 
              value={newStage.name}
              onChange={(e) => setNewStage(prev => ({ ...prev, name: e.target.value }))}
              className={styles.input}
              required
            />
            <div className={styles.colorWrapper}>
               <label className={styles.colorLabel}>Theme:</label>
               <input 
                type="color" 
                value={newStage.color}
                onChange={(e) => setNewStage(prev => ({ ...prev, color: e.target.value }))}
                className={styles.colorPicker}
                style={{ borderColor: newStage.color }}
              />
            </div>
            <button type="submit" className={styles.buttonPrimary}>Add Stage</button>
          </form>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Workflow Pipeline</h3>
          <p className={styles.sectionHint}>
            Items moved into a "Not Proceeding" stage prompt for a reason, shown at the top of the item detail.
          </p>
          <div className={styles.listWrapper}>
            {loading ? (
              <div className={styles.message}>Loading stages...</div>
            ) : (
              <div className={styles.tableWrapper}>
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="stages-table">
                    {(provided) => (
                      <table 
                        className={styles.table}
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                      >
                        <thead>
                          <tr>
                            <th className={styles.th} style={{ width: '40px' }}></th>
                            <th className={styles.th} style={{ width: '60px' }}>#</th>
                            <th className={styles.th}>Stage Name</th>
                            <th className={styles.th} style={{ width: '100px', textAlign: 'center' }}>Features</th>
                            <th className={styles.th} style={{ width: '120px' }}>Theme</th>
                            <th className={styles.th} style={{ width: '140px' }}>Visibility</th>
                            <th className={styles.th} style={{ width: '160px' }}>Not Proceeding</th>
                            <th className={styles.th} style={{ width: '80px', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stages.map((s, index) => (
                            <Draggable key={s.id} draggableId={s.id} index={index}>
                              {(provided, snapshot) => (
                                <tr 
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={styles.tr}
                                  style={{
                                    ...provided.draggableProps.style,
                                    backgroundColor: snapshot.isDragging ? 'var(--bg-secondary)' : '#fff',
                                    boxShadow: snapshot.isDragging ? 'var(--shadow-lg)' : 'none'
                                  }}
                                >
                                  {/* Drag Handle Cell */}
                                  <td className={styles.td}>
                                    <div {...provided.dragHandleProps} className={styles.dragHandle}>
                                      <GripVertical size={16} strokeWidth={2.5} />
                                    </div>
                                  </td>

                                  {/* Order Cell */}
                                  <td className={styles.td}>
                                    <div className={styles.orderBadge}>{index + 1}</div>
                                  </td>

                                  {/* Name Cell */}
                                  <td className={styles.td}>
                                    <div className={styles.nameCell}>
                                      <div className={styles.colorDot} style={{ backgroundColor: s.color }}></div>
                                      <input 
                                        className={styles.itemNameInput} 
                                        value={s.name} 
                                        onChange={(e) => handleUpdate(s.id, { name: e.target.value })}
                                        onBlur={() => fetchStages()}
                                      />
                                    </div>
                                  </td>

                                  {/* Feature Count Cell */}
                                  <td className={styles.td} style={{ textAlign: 'center' }}>
                                    <span className={styles.countBadge}>
                                      {s.feature_count || 0}
                                    </span>
                                  </td>

                                  {/* Color Cell */}
                                  <td className={styles.td}>
                                    <div className={styles.colorPickerWrapper}>
                                      <input 
                                        type="color" 
                                        value={s.color}
                                        onChange={(e) => handleUpdate(s.id, { color: e.target.value })}
                                        className={styles.colorPickerSmall}
                                        style={{ borderColor: s.color }}
                                      />
                                      <span className={styles.hexLabel}>{s.color.toUpperCase()}</span>
                                    </div>
                                  </td>

                                  {/* Visibility Cell */}
                                  <td className={styles.td}>
                                    <button 
                                      onClick={() => handleUpdate(s.id, { is_visible: !s.is_visible })} 
                                      className={styles.visibilityToggle}
                                      style={{ 
                                        backgroundColor: s.is_visible ? 'var(--bg-secondary)' : 'var(--error-bg)',
                                        color: s.is_visible ? 'var(--text-secondary)' : 'var(--error-color)'
                                      }}
                                    >
                                      {s.is_visible ? (
                                        <>
                                          <Eye size={16} strokeWidth={2.5} />
                                          Visible
                                        </>
                                      ) : (
                                        <>
                                          <EyeOff size={16} strokeWidth={2.5} />
                                          Hidden
                                        </>
                                      )}
                                    </button>
                                  </td>

                                  {/* Not Proceeding Cell */}
                                  <td className={styles.td}>
                                    <button
                                      onClick={() => handleUpdate(s.id, { is_rejection_stage: !s.is_rejection_stage })}
                                      className={styles.visibilityToggle}
                                      disabled={!isSuperAdmin}
                                      title={isSuperAdmin ? 'Toggle whether moving an item here prompts for a reason' : 'Only super admins can change this'}
                                      style={{
                                        backgroundColor: s.is_rejection_stage ? 'var(--error-bg)' : 'var(--bg-secondary)',
                                        color: s.is_rejection_stage ? 'var(--error-color)' : 'var(--text-secondary)',
                                        opacity: isSuperAdmin ? 1 : 0.6,
                                        cursor: isSuperAdmin ? 'pointer' : 'not-allowed',
                                      }}
                                    >
                                      <Ban size={16} strokeWidth={2.5} />
                                      {s.is_rejection_stage ? 'Not Proceeding' : 'Off'}
                                    </button>
                                  </td>

                                  {/* Actions Cell */}
                                  <td className={styles.td} style={{ textAlign: 'right' }}>
                                    <button onClick={() => handleDeleteAttempt(s)} className={styles.deleteBtn} title="Delete stage">
                                      <Trash2 size={16} strokeWidth={2.5} />
                                    </button>
                                  </td>
                                </tr>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </tbody>
                      </table>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            )}
          </div>
        </section>

        {showDeleteModal && (
          <ReassignDialog
            title="Safe Stage Deletion"
            message={`The stage "${stageToDelete?.name}" has features assigned to it. Where should these features be moved?`}
            options={stages.filter(s => s.id !== stageToDelete?.id).map(s => ({ value: s.id, label: s.name }))}
            value={reassignTo}
            onChange={setReassignTo}
            confirmText="Migrate & Delete"
            onConfirm={handleConfirmDeleteWithReassign}
            onCancel={() => setShowDeleteModal(false)}
          />
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminStagesPage;
