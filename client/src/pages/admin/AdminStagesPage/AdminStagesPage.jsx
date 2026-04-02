import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import AdminLayout from '../../../components/AdminLayout';
import { getStages, createStage, updateStage, deleteStage, reorderStages } from '../../../api/stages';
import { useToast } from '../../../contexts/ToastContext';
import styles from './AdminStagesPage.module.css';

const AdminStagesPage = () => {
  const { addToast } = useToast();
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newStage, setNewStage] = useState({ name: '', color: '#64748b', order_idx: 0, is_visible: 1 });
  
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
      setNewStage({ name: '', color: '#64748b', order_idx: stages.length + 1, is_visible: 1 });
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
            <div className={styles.breadcrumb}>ADMIN › CONFIGURATION</div>
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
              />
            </div>
            <button type="submit" className={styles.buttonPrimary}>Add Stage</button>
          </form>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Workflow Pipeline</h3>
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
                                      <svg className={styles.iconTiny} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                                        <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                                      </svg>
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
                                      />
                                      <span className={styles.hexLabel}>{s.color.toUpperCase()}</span>
                                    </div>
                                  </td>

                                  {/* Visibility Cell */}
                                  <td className={styles.td}>
                                    <button 
                                      onClick={() => handleUpdate(s.id, { is_visible: s.is_visible === 1 ? 0 : 1 })} 
                                      className={styles.visibilityToggle}
                                      style={{ 
                                        backgroundColor: s.is_visible === 1 ? 'var(--bg-secondary)' : 'var(--error-bg)',
                                        color: s.is_visible === 1 ? 'var(--text-secondary)' : 'var(--error-color)'
                                      }}
                                    >
                                      {s.is_visible === 1 ? (
                                        <>
                                          <svg className={styles.iconSmall} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                            <circle cx="12" cy="12" r="3" />
                                          </svg>
                                          Visible
                                        </>
                                      ) : (
                                        <>
                                          <svg className={styles.iconSmall} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                                            <line x1="1" y1="1" x2="23" y2="23" />
                                          </svg>
                                          Hidden
                                        </>
                                      )}
                                    </button>
                                  </td>

                                  {/* Actions Cell */}
                                  <td className={styles.td} style={{ textAlign: 'right' }}>
                                    <button onClick={() => handleDeleteAttempt(s)} className={styles.deleteBtn} title="Delete stage">
                                      <svg className={styles.iconSmall} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                         <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                                      </svg>
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
          <div className={styles.modalOverlay}>
            <div className={styles.modal}>
              <h3 className={styles.modalTitle}>Safe Stage Deletion</h3>
              <p className={styles.modalText}>
                The stage <strong>{stageToDelete?.name}</strong> has features assigned to it. 
                Where should these features be moved?
              </p>
              <select 
                className={styles.modalSelect} 
                value={reassignTo} 
                onChange={(e) => setReassignTo(e.target.value)}
              >
                {stages.filter(s => s.id !== stageToDelete?.id).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <div className={styles.modalActions}>
                <button onClick={() => setShowDeleteModal(false)} className={styles.cancelBtn}>Cancel</button>
                <button onClick={handleConfirmDeleteWithReassign} className={styles.confirmDeleteBtn}>Migrate & Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default AdminStagesPage;
