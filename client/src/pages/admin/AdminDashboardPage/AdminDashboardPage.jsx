import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import { getFeatures, updateFeature } from '../../../api/features';
import { getCategories } from '../../../api/categories';
import { getStages } from '../../../api/stages';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useToast } from '../../../contexts/ToastContext';
import { useRoadmapFilters } from '../../../hooks/useRoadmapFilters';
import FeaturesTable from './FeaturesTable';
import styles from './AdminDashboardPage.module.css';

const AdminDashboardPage = () => {
  const { addToast } = useToast();
  const [features, setFeatures] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const {
    viewMode,
    searchTerm,
    debouncedSearchTerm,
    sortBy,
    sortDir,
    showAllStages,
    groupBy,
    selectedCategoryIds,
    selectedStatusIds,
    updateFilters,
    clearAllFilters,
    toggleSort
  } = useRoadmapFilters();

  const fetchFeatures = async () => {
    try {
      const [fData, cData, stData] = await Promise.all([
        getFeatures({ limit: 1000 }),
        getCategories(),
        getStages()
      ]);
      setFeatures(fData.data || []);
      setCategories(cData);
      setStages(stData);
    } finally {
      setLoading(false);
    }
  };

  const filteredFeatures = useMemo(() => {
    let result = features.filter(f => {
      const searchLower = debouncedSearchTerm.toLowerCase();
      const matchesSearch = 
        !searchLower || 
        (f.title && f.title.toLowerCase().includes(searchLower)) ||
        (f.owner && f.owner.toLowerCase().includes(searchLower)) ||
        (f.category_name && f.category_name.toLowerCase().includes(searchLower)) ||
        (Array.isArray(f.tags) && f.tags.join(' ').toLowerCase().includes(searchLower));
      
      const matchesCategory = selectedCategoryIds.length === 0 || selectedCategoryIds.includes(f.category_id?.toString());
      
      const matchesStatus = selectedStatusIds.length === 0 || 
        (selectedStatusIds.includes('draft') && f.is_published === 0) || 
        selectedStatusIds.includes(f.stage_id?.toString());

      return matchesSearch && matchesCategory && matchesStatus;
    });


    // Apply global sorting (Kanban & Default Table Fallback)
    result.sort((a, b) => {
      
      if (sortBy === 'newest') {
        return new Date(b.created_at) - new Date(a.created_at);
      }
      if (sortBy === 'updated' || sortBy === 'updated_at') {
        return new Date(b.updated_at) - new Date(a.updated_at);
      }
      if (sortBy === 'votes' || sortBy === 'vote_count') {
        return b.vote_count - a.vote_count;
      }
      if (sortBy === 'gravity' || sortBy === 'gravity_score') {
        return b.gravity_score - a.gravity_score;
      }
      if (sortBy === 'title' || sortBy === 'owner' || sortBy === 'status' || sortBy === 'priority') {
          const vA = String(a[sortBy] || '').toLowerCase();
          const vB = String(b[sortBy] || '').toLowerCase();
          return sortDir === 'asc' ? vA.localeCompare(vB) : vB.localeCompare(vA);
      }
      // Default: Pinned first, then gravity
      let r = 0;
      if (a.pinned !== b.pinned) r = b.pinned - a.pinned;
      else if (a.gravity_score !== b.gravity_score) r = (b.gravity_score || 0) - (a.gravity_score || 0);
      else r = new Date(b.created_at) - new Date(a.created_at);
      
      return sortDir === 'asc' ? r : -r;
    });

    return result;
  }, [features, debouncedSearchTerm, selectedCategoryIds, selectedStatusIds, sortBy, sortDir]);



  const columnsData = useMemo(() => {
    const map = {};
    stages.forEach(s => {
      map[s.id] = filteredFeatures.filter(f => f.stage_id === s.id || (f.stage_id === null && f.stage_slug === s.slug));
    });
    return map;
  }, [filteredFeatures, stages]);

  const columns = useMemo(() => {
    return showAllStages ? stages : stages.filter(s => s.is_visible === 1);
  }, [stages, showAllStages]);

  useEffect(() => {
    fetchFeatures();
  }, []);

  const onUpdateFeatureField = async (featureId, field, newValue) => {
    const featureIdx = features.findIndex(f => f.id.toString() === featureId.toString());
    if (featureIdx === -1) return;

    const oldFeature = features[featureIdx];
    if (oldFeature[field] === newValue) return;

    const newFeatures = [...features];
    newFeatures[featureIdx] = { ...oldFeature, [field]: newValue };
    setFeatures(newFeatures);

    try {
      await updateFeature(featureId, { [field]: newValue });
      addToast(`Updated ${field.replace('_', ' ')}`, 'success');
    } catch {
      addToast(`Failed to update ${field}`, 'error');
      fetchFeatures();
    }
  };

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    
    const draggableIdStr = draggableId.toString();
    const sourceIdx = features.findIndex(f => f.id.toString() === draggableIdStr);
    if (sourceIdx === -1) return;

    const oldFeature = features[sourceIdx];
    const newStageId = destination.droppableId;
    const destStage = stages.find(s => s.id === newStageId);

    const newFeatures = [...features];
    newFeatures[sourceIdx] = { 
      ...oldFeature, 
      stage_id: newStageId,
      stage_name: destStage?.name || oldFeature.stage_name, 
      stage_color: destStage?.color || oldFeature.stage_color,
      stage_slug: destStage?.slug || oldFeature.stage_slug,
      status: destStage?.slug || oldFeature.status 
    };
    setFeatures(newFeatures);

    try {
      await updateFeature(draggableIdStr, { stage_id: newStageId, status: destStage?.slug });
      addToast(`Moved to ${destStage?.name || 'new stage'}`, 'success');
    } catch {
      addToast('Failed to move feature', 'error');
      fetchFeatures(); 
    }
  };

  const priorityClasses = {
    'Critical': styles.priorityCritical,
    'High': styles.priorityHigh,
    'Medium': styles.priorityMedium,
    'Low': styles.priorityLow
  };

  return (
    <AdminLayout>
      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <div className={styles.breadcrumb}>PROJECT › INDIGO ETHER</div>
            <h1 className={styles.h1}>Roadmap Editor</h1>
          </div>
          <div className={styles.headerActions}>
            <Link to="/admin/features/new" className={styles.newFeatureBtn}>
              <svg className={styles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Feature
            </Link>
          </div>
        </header>

        {/* Global Filter Bar */}
        <div className={styles.filterBar}>
           <div className={styles.searchWrapper}>
              <svg className={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
               <input 
                 type="text" 
                 placeholder="Search by title, owner, or #tags..." 
                 className={styles.searchInput} 
                 value={searchTerm}
                 onChange={(e) => updateFilters({ q: e.target.value })}
               />
           </div>
           
           <div className={styles.chipGroup}>
              {selectedCategoryIds.map(id => {
                const cat = categories.find(c => c.id.toString() === id);
                return (
                  <div key={`cat-${id}`} className={styles.chip}>
                    <span className={styles.chipLabel}>Category:</span>
                    <span className={styles.chipValue}>{cat?.name || id}</span>
                    <button className={styles.chipClose} onClick={() => updateFilters({ categories: selectedCategoryIds.filter(x => x !== id) })}>✕</button>
                  </div>
                );
              })}
              {selectedStatusIds.map(id => {
                const st = id === 'draft' ? { name: 'Drafts Only' } : stages.find(s => s.id.toString() === id);
                return (
                  <div key={`st-${id}`} className={styles.chip}>
                    <span className={styles.chipLabel}>Status:</span>
                    <span className={styles.chipValue}>{st?.name || id}</span>
                    <button className={styles.chipClose} onClick={() => updateFilters({ statuses: selectedStatusIds.filter(x => x !== id) })}>✕</button>
                  </div>
                );
              })}
              
              <select 
                className={styles.addFilterBtn} 
                value=""
                onChange={(e) => {
                  const parts = e.target.value.split(':');
                  if (parts[0] === 'cat' && !selectedCategoryIds.includes(parts[1])) {
                    updateFilters({ categories: [...selectedCategoryIds, parts[1]] });
                  } else if (parts[0] === 'st' && !selectedStatusIds.includes(parts[1])) {
                    updateFilters({ statuses: [...selectedStatusIds, parts[1]] });
                  } else if (parts[0] === 'sort') {
                    updateFilters({ sort: parts[1], sortDir: 'desc' });
                  }
                }}
              >
                <option value="" disabled>+ Add Filter</option>
                <optgroup label="Sort By">
                  <option value="sort:default">Default Sort</option>
                  <option value="sort:updated_at">Recently Modified</option>
                  <option value="sort:created_at">Newest First</option>
                  <option value="sort:vote_count">Most Votes</option>
                  <option value="sort:gravity_score">Highest Gravity</option>
                </optgroup>
                <optgroup label="Category">
                  {categories.map(c => <option key={`opt-cat-${c.id}`} value={`cat:${c.id}`}>{c.name}</option>)}
                </optgroup>
                <optgroup label="Status">
                  <option value="st:draft">Drafts Only</option>
                  {stages.map(s => <option key={`opt-st-${s.id}`} value={`st:${s.id}`}>{s.name}</option>)}
                </optgroup>
              </select>

              {(selectedCategoryIds.length > 0 || selectedStatusIds.length > 0 || debouncedSearchTerm || sortBy !== 'default') && (
                <button className={styles.chipClose} style={{width: 'auto', padding: '0 8px'}} onClick={clearAllFilters}>Clear All</button>
              )}
           </div>

           <div className={styles.filterActions}>
              <div className={styles.viewToggleGroup}>
                <button 
                  className={viewMode === 'board' ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                  onClick={() => updateFilters({ view: 'board' })}
                >
                  Board
                </button>
                <button 
                  className={viewMode === 'list' ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                  onClick={() => updateFilters({ view: 'list' })}
                >
                  List
                </button>
              </div>

              <div className={styles.viewToggleGroup}>
                <button 
                  className={!showAllStages ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                  onClick={() => updateFilters({ allStages: 'false' })}
                  title="Show only visible stages"
                >
                  Visible
                </button>
                <button 
                  className={showAllStages ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                  onClick={() => updateFilters({ allStages: 'true' })}
                  title="Show all stages including hidden"
                >
                  All
                </button>
              </div>

               {viewMode === 'list' && (
                 <>
                   <span className={styles.filterLabel}>Group by:</span>
                   <div className={styles.viewToggleGroup}>
                     <button 
                       className={groupBy === 'category' ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                       onClick={() => updateFilters({ groupBy: 'category' })}
                     >
                       Category
                     </button>
                     <button 
                       className={groupBy === 'status' ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                       onClick={() => updateFilters({ groupBy: 'status' })}
                     >
                       Status
                     </button>
                   </div>
                 </>
               )}


              <button className={styles.iconBtn}>
                 <svg className={styles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 4h18M6 8h12M9 12h6M12 16h0" />
                 </svg>
              </button>
           </div>
        </div>

        {/* Kanban Board */}
         <div className={styles.kanbanContainer}>
           {loading ? (
             <div className={styles.message}>Loading roadmap board...</div>
           ) : filteredFeatures.length === 0 && (searchTerm || selectedCategoryIds.length > 0 || selectedStatusIds.length > 0) ? (
             <div className={styles.emptyContainer}>
                <div className={styles.emptyIcon}>🔍</div>
                <h3 className={styles.emptyTitle}>No matching features found</h3>
                <p className={styles.emptyText}>Adjust your filters or search terms to find what you're looking for.</p>
                <button 
                  className={styles.clearFiltersBtn}
                  onClick={clearAllFilters}
                >
                  Clear all filters
                </button>
             </div>
           ) : viewMode === 'list' ? (
             <FeaturesTable 
              features={filteredFeatures} 
              stages={stages}
              onUpdateFeatureField={onUpdateFeatureField} 
              groupBy={groupBy}
              sortBy={sortBy}
              sortDir={sortDir}
              onSort={toggleSort}
            />
           ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className={styles.board}>
                {columns.map(col => {
                  const columnFeatures = columnsData[col.id] || [];
                  return (
                    <div 
                      key={col.id} 
                      className={styles.column}
                      style={{ 
                        backgroundColor: `${col.color}0D` 
                      }}
                    >
                      <header className={styles.columnHeader}>
                        <div className={styles.columnTitleWrap}>
                           <span className={styles.columnDot} style={{ backgroundColor: col.color }} />
                           <h2 className={styles.columnTitle}>{col.name}</h2>
                           <span className={styles.columnCount}>{columnFeatures.length}</span>
                        </div>
                        <button className={styles.columnMoreBtn}>•••</button>
                      </header>
                      
                      <Droppable droppableId={col.id}>
                        {(provided, snapshot) => (
                          <div 
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                             className={styles.columnCards}
                             style={{
                               backgroundColor: snapshot.isDraggingOver ? 'rgba(0,0,0,0.05)' : 'transparent',
                               minHeight: '400px',
                               borderRadius: 'var(--radius-md)',
                               transition: 'background-color 0.2s ease'
                             }}
                          >
                            {columnFeatures.map((feat, index) => (
                              <Draggable key={feat.id.toString()} draggableId={feat.id.toString()} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className={styles.card}
                                    style={{
                                      ...provided.draggableProps.style,
                                      opacity: snapshot.isDragging ? 0.9 : 1,
                                      boxShadow: snapshot.isDragging ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
                                      cursor: 'grab'
                                    }}
                                  >
                                    <div onClick={() => {
                                      if (!snapshot.isDragging) {
                                        window.location.href = `/admin/features/${feat.id}/edit`;
                                      }
                                    }}>
                                      <div className={styles.cardHeader}>
                                         <span className={styles.cardTag}>{feat.category_name || 'GENERAL'}</span>
                                         <div className={styles.cardHeaderRight}>
                                           {feat.is_published === 0 && <span className={styles.draftBadgeBadge}>DRAFT</span>}
                                           <span className={`${styles.priorityBadge} ${priorityClasses[feat.priority] || ''}`}>
                                             {feat.priority}
                                           </span>
                                           {feat.pinned === 1 && <span className={styles.pinIcon}>★</span>}
                                          </div>
                                      </div>
                                      <h4 className={styles.cardTitle}>{feat.title}</h4>
                                      {feat.owner && <div className={styles.cardOwner}>Owner: {feat.owner}</div>}
                                        <div className={styles.cardFooter}>
                                           <div className={styles.cardUpdatedDate}>
                                             Updated {new Date(feat.updated_at).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
                                           </div>
                                           <div className={styles.cardMetrics}>
                                             <div className={styles.voteBadge}>
                                                <svg className={styles.voteIcon} viewBox="0 0 24 24" fill="currentColor">
                                                   <path d="M12 5l-8 8h16l-8-8z" />
                                                </svg>
                                                {feat.vote_count} votes
                                             </div>
                                             <div className={`${styles.gravityBadge} ${
                                               (feat.gravity_score || 0) >= 60 ? styles.gravityHigh : 
                                               (feat.gravity_score || 0) >= 30 ? styles.gravityMid : 
                                               styles.gravityLow
                                             }`}>
                                               <span className={styles.gravityIcon}>⚡</span>
                                               {feat.gravity_score || 0}
                                             </div>
                                           </div>
                                        </div>
                                    </div>

                                  </div>
                                )}
                              </Draggable>
                            ))}
                            {provided.placeholder}
                          </div>
                        )}
                      </Droppable>
                    </div>
                  );
                })}
              </div>
            </DragDropContext>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboardPage;
