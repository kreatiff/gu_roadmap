import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import AdminLayout from '../../../components/AdminLayout';
import { getCategories, createCategory, updateCategory, deleteCategory, reorderCategories } from '../../../api/categories';
import { useToast } from '../../../contexts/ToastContext';
import IconPicker from '../../../components/IconPicker';
import CategoryIcon from '../../../components/CategoryIcon';
import styles from './AdminCategoriesPage.module.css';

const AdminCategoriesPage = () => {
  const { addToast } = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState({ name: '', color: '#e8341c', icon: 'Briefcase', order_idx: 0 });

  // Deletion & Migration state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [reassignTo, setReassignTo] = useState('');

  const fetchCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
      if (data.length > 0) setReassignTo(data[0].id);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newCategory.name) return;
    try {
      await createCategory({ ...newCategory, order_idx: categories.length });
      setNewCategory({ name: '', color: '#e8341c', icon: 'Briefcase', order_idx: categories.length + 1 });
      addToast('Category created successfully', 'success');
      fetchCategories();
    } catch {
      addToast('Failed to create category', 'error');
    }
  };

  const handleDeleteAttempt = async (category) => {
    try {
      await deleteCategory(category.id);
      addToast('Category deleted', 'success');
      fetchCategories();
    } catch (err) {
      if (err.status === 409) {
        setCategoryToDelete(category);
        setShowDeleteModal(true);
        const firstOther = categories.find(c => c.id !== category.id);
        if (firstOther) setReassignTo(firstOther.id);
      } else {
        addToast('Failed to delete category', 'error');
      }
    }
  };

  const handleConfirmDeleteWithReassign = async () => {
    try {
      await deleteCategory(categoryToDelete.id, reassignTo);
      addToast('Category deleted and features migrated', 'success');
      setShowDeleteModal(false);
      setCategoryToDelete(null);
      fetchCategories();
    } catch {
      addToast('Migration failed', 'error');
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      // Optimistic update
      setCategories(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
      await updateCategory(id, data);
    } catch {
      addToast('Failed to update category', 'error');
      fetchCategories();
    }
  };

  const onDragEnd = async (result) => {
    if (!result.destination) return;
    const reordered = Array.from(categories);
    const [removed] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, removed);

    setCategories(reordered);
    
    try {
      await reorderCategories(reordered.map(c => c.id));
      addToast('Order updated', 'success');
      fetchCategories();
    } catch {
      addToast('Failed to reorder categories', 'error');
      fetchCategories();
    }
  };

  return (
    <AdminLayout>
      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <div className={styles.breadcrumb}>ADMIN › CONFIGURATION</div>
            <h1 className={styles.h1}>Categories</h1>
          </div>
          <Link to="/admin" className={styles.backBtn}>← Back to Dashboard</Link>
        </header>

        <section className={styles.category}>
          <h3 className={styles.categoryTitle}>Add New Category</h3>
          <form onSubmit={handleCreate} className={styles.formInline}>
            <input 
              type="text" 
              placeholder="e.g. Mobile App, Student Portal..." 
              value={newCategory.name}
              onChange={(e) => setNewCategory(prev => ({ ...prev, name: e.target.value }))}
              className={styles.input}
              required
            />
            <div className={styles.colorWrapper}>
               <label className={styles.colorLabel}>Theme:</label>
                <input 
                 type="color" 
                 value={newCategory.color}
                 onChange={(e) => setNewCategory(prev => ({ ...prev, color: e.target.value }))}
                 className={styles.colorPicker}
                 style={{ borderColor: newCategory.color }}
               />
            </div>
            <div className={styles.iconWrapper}>
               <label className={styles.colorLabel}>Icon:</label>
               <IconPicker 
                 selectedIcon={newCategory.icon} 
                 onSelect={(icon) => setNewCategory(prev => ({ ...prev, icon }))}
                 color={newCategory.color}
               />
            </div>
            <button type="submit" className={styles.buttonPrimary}>Add Category</button>
          </form>
        </section>

        <section className={styles.category}>
          <h3 className={styles.categoryTitle}>Application Scope</h3>
          <div className={styles.listWrapper}>
            {loading ? (
              <div className={styles.message}>Loading categories...</div>
            ) : (
              <div className={styles.tableWrapper}>
                <DragDropContext onDragEnd={onDragEnd}>
                  <Droppable droppableId="categories-table">
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
                             <th className={styles.th}>Category Name</th>
                             <th className={styles.th} style={{ width: '160px' }}>Icon</th>
                             <th className={styles.th} style={{ width: '100px', textAlign: 'center' }}>Features</th>
                             <th className={styles.th} style={{ width: '120px' }}>Theme</th>
                             <th className={styles.th} style={{ width: '80px', textAlign: 'right' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categories.map((c, index) => (
                            <Draggable key={c.id} draggableId={c.id} index={index}>
                              {(provided, snapshot) => (
                                <tr 
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  className={`${styles.tr} ${snapshot.isDragging ? styles.isDragging : ''}`}
                                  style={{
                                    ...provided.draggableProps.style,
                                    backgroundColor: snapshot.isDragging ? 'var(--bg-secondary)' : '#fff'
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
                                      <CategoryIcon 
                                        name={c.icon} 
                                        color={c.color} 
                                        className={styles.rowIcon} 
                                      />
                                      <input 
                                        className={styles.itemNameInput} 
                                        value={c.name} 
                                        onChange={(e) => handleUpdate(c.id, { name: e.target.value })}
                                        onBlur={() => fetchCategories()}
                                      />
                                    </div>
                                  </td>

                                  {/* Icon Picker Cell */}
                                  <td className={styles.td}>
                                    <IconPicker 
                                      selectedIcon={c.icon || 'Briefcase'} 
                                      onSelect={(icon) => handleUpdate(c.id, { icon })}
                                      color={c.color}
                                    />
                                  </td>

                                  {/* Feature Count Cell */}
                                  <td className={styles.td} style={{ textAlign: 'center' }}>
                                    <span className={styles.countBadge}>
                                      {c.feature_count || 0}
                                    </span>
                                  </td>

                                  {/* Color Cell */}
                                  <td className={styles.td}>
                                    <div className={styles.colorPickerWrapper}>
                                      <input 
                                        type="color" 
                                        value={c.color}
                                        onChange={(e) => handleUpdate(c.id, { color: e.target.value })}
                                        className={styles.colorPickerSmall}
                                        style={{ borderColor: c.color }}
                                      />
                                      <span className={styles.hexLabel}>{c.color.toUpperCase()}</span>
                                    </div>
                                  </td>

                                  {/* Actions Cell */}
                                  <td className={styles.td} style={{ textAlign: 'right' }}>
                                    <button onClick={() => handleDeleteAttempt(c)} className={styles.deleteBtn} title="Delete category">
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
              <h3 className={styles.modalTitle}>Safe Category Deletion</h3>
              <p className={styles.modalText}>
                The category <strong>{categoryToDelete?.name}</strong> has features assigned to it. 
                Where should these features be moved?
              </p>
              <select 
                className={styles.modalSelect} 
                value={reassignTo} 
                onChange={(e) => setReassignTo(e.target.value)}
              >
                {categories.filter(c => c.id !== categoryToDelete?.id).map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
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

export default AdminCategoriesPage;
