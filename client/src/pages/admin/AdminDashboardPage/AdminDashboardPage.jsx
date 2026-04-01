import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import StatusBadge from '../../../components/StatusBadge';
import { getFeatures, updateFeature } from '../../../api/features';
import { getSections } from '../../../api/sections';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useToast } from '../../../contexts/ToastContext';
import FeaturesTable from './FeaturesTable';

const AdminDashboardPage = () => {
  const { addToast } = useToast();
  const [features, setFeatures] = useState([]);
  const [sections, setSections] = useState([]);
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('adminViewMode') || 'board';
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');

  // Save view selection
  useEffect(() => {
    localStorage.setItem('adminViewMode', viewMode);
  }, [viewMode]);

  const fetchFeatures = async () => {
    try {
      const [fData, sData] = await Promise.all([
        getFeatures({ limit: 1000 }),
        getSections()
      ]);
      setFeatures(fData.data || []);
      setSections(sData);
    } finally {
      setLoading(false);
    }
  };

  const filteredFeatures = useMemo(() => {
    return features.filter(f => {
      const matchesSearch = 
        !searchTerm || 
        (f.title && f.title.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.owner && f.owner.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (f.section_name && f.section_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (Array.isArray(f.tags) && f.tags.join(' ').toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesSection = !selectedSectionId || f.section_id === selectedSectionId;

      return matchesSearch && matchesSection;
    });
  }, [features, searchTerm, selectedSectionId]);

  const columnsData = useMemo(() => {
    return {
      under_review: filteredFeatures.filter(f => f.status === 'under_review'),
      planned: filteredFeatures.filter(f => f.status === 'planned'),
      in_progress: filteredFeatures.filter(f => f.status === 'in_progress'),
      launched: filteredFeatures.filter(f => f.status === 'launched')
    };
  }, [filteredFeatures]);

  useEffect(() => {
    fetchFeatures();
  }, []);

  const columns = [
    { id: 'under_review', title: 'Under Consideration', color: '#64748b' },
    { id: 'planned', title: 'Planned', color: '#e8341c' },
    { id: 'in_progress', title: 'In Progress', color: '#ea580c' },
    { id: 'launched', title: 'Launched', color: '#059669' }
  ];

  const onUpdateFeatureField = async (featureId, field, newValue) => {
    // 1. Find feature in flat list
    const featureIdx = features.findIndex(f => f.id.toString() === featureId.toString());
    if (featureIdx === -1) return;

    const oldFeature = features[featureIdx];
    if (oldFeature[field] === newValue) return;

    // 2. Optimistic Update (flat features list)
    const newFeatures = [...features];
    newFeatures[featureIdx] = { ...oldFeature, [field]: newValue };
    setFeatures(newFeatures);

    // 4. API Call
    try {
      await updateFeature(featureId, { [field]: newValue });
      addToast(`Updated ${field.replace('_', ' ')}`, 'success');
    } catch (err) {
      addToast(`Failed to update ${field}`, 'error');
      fetchFeatures();
    }
  };

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    // Dropped outside a list
    if (!destination) return;

    // Dropped in same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    // Reuse our status update logic if moved between columns
    if (source.droppableId !== destination.droppableId) {
      onUpdateFeatureField(draggableId, 'status', destination.droppableId);
      return;
    }

    // If just reordering within same column (Kanban specific reordering)
    const start = columnsData[source.droppableId];
    const newList = Array.from(start);
    const [removed] = newList.splice(source.index, 1);
    newList.splice(destination.index, 0, removed);

    setColumnsData({
      ...columnsData,
      [source.droppableId]: newList
    });
  };

  return (
    <AdminLayout>
      <div style={styles.content}>
        <header style={styles.header}>
          <div>
            <div style={styles.breadcrumb}>PROJECT › INDIGO ETHER</div>
            <h1 style={styles.h1}>Roadmap Editor</h1>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.syncBtn}>
              <svg style={styles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sync with Public Roadmap
            </button>
            <Link to="/admin/features/new" style={styles.newFeatureBtn}>
              <svg style={styles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New Feature
            </Link>
          </div>
        </header>

        {/* Global Filter Bar */}
        <div style={styles.filterBar}>
           <div style={styles.searchWrapper}>
              <svg style={styles.searchIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
              </svg>
               <input 
                 type="text" 
                 placeholder="Search by title, owner, or #tags..." 
                 style={styles.searchInput} 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
               />
           </div>
           <div style={styles.filterActions}>
              <div style={styles.viewToggleGroup}>
                <button 
                  style={viewMode === 'board' ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                  onClick={() => setViewMode('board')}
                >
                  Board
                </button>
                <button 
                  style={viewMode === 'list' ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                  onClick={() => setViewMode('list')}
                >
                  List
                </button>
              </div>
              <span style={styles.filterLabel}>Filter:</span>
               <select 
                 style={styles.select} 
                 value={selectedSectionId}
                 onChange={(e) => setSelectedSectionId(e.target.value)}
               >
                 <option value="">All Categories</option>
                 {sections.map(s => (
                   <option key={s.id} value={s.id}>{s.name}</option>
                 ))}
               </select>
              <button style={styles.iconBtn}>
                 <svg style={styles.btnIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 4h18M6 8h12M9 12h6M12 16h0" />
                 </svg>
              </button>
           </div>
        </div>

        {/* Kanban Board */}
         <div style={styles.kanbanContainer}>
           {loading ? (
             <div style={styles.message}>Loading roadmap board...</div>
           ) : filteredFeatures.length === 0 && (searchTerm || selectedSectionId) ? (
             <div style={styles.emptyContainer}>
                <div style={styles.emptyIcon}>🔍</div>
                <h3 style={styles.emptyTitle}>No matching features found</h3>
                <p style={styles.emptyText}>Adjust your filters or search terms to find what you're looking for.</p>
                <button 
                  style={styles.clearFiltersBtn}
                  onClick={() => { setSearchTerm(''); setSelectedSectionId(''); }}
                >
                  Clear all filters
                </button>
             </div>
           ) : viewMode === 'list' ? (
             <FeaturesTable features={filteredFeatures} onUpdateFeatureField={onUpdateFeatureField} />
           ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <div style={styles.board}>
                {columns.map(col => {
                  const columnFeatures = columnsData[col.id] || [];
                  return (
                    <div key={col.id} style={styles.column}>
                      <header style={styles.columnHeader}>
                        <div style={styles.columnTitleWrap}>
                           <span style={{ ...styles.columnDot, backgroundColor: col.color }} />
                           <h3 style={styles.columnTitle}>{col.title}</h3>
                           <span style={styles.columnCount}>{columnFeatures.length}</span>
                        </div>
                        <button style={styles.columnMoreBtn}>•••</button>
                      </header>
                      
                      <Droppable droppableId={col.id}>
                        {(provided, snapshot) => (
                          <div 
                            {...provided.droppableProps}
                            ref={provided.innerRef}
                             style={{
                               ...styles.columnCards,
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
                                    style={{
                                      ...styles.card,
                                      ...provided.draggableProps.style,
                                      opacity: snapshot.isDragging ? 0.9 : 1,
                                      boxShadow: snapshot.isDragging ? 'var(--shadow-lg)' : 'var(--shadow-sm)',
                                      cursor: 'grab'
                                    }}
                                  >
                                    <div onClick={(e) => {
                                      // Allow link behavior on click if not dragging
                                      if (!snapshot.isDragging) {
                                        window.location.href = `/admin/features/${feat.id}/edit`;
                                      }
                                    }}>
                                      <div style={styles.cardHeader}>
                                         <span style={styles.cardTag}>{feat.section_name || 'GENERAL'}</span>
                                         <div style={styles.cardHeaderRight}>
                                           <span style={{ 
                                             ...styles.priorityBadge, 
                                             backgroundColor: styles.priorityColors[feat.priority] || '#94a3b8' 
                                           }}>
                                             {feat.priority}
                                           </span>
                                           {feat.pinned === 1 && <span style={styles.pinTag}>★</span>}
                                         </div>
                                      </div>
                                      <h4 style={styles.cardTitle}>{feat.title}</h4>
                                      {feat.owner && <div style={styles.cardOwner}>Owner: {feat.owner}</div>}
                                       <div style={styles.cardFooter}>
                                          <div style={styles.voteBadge}>
                                             <svg style={styles.voteIcon} viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M12 5l-8 8h16l-8-8z" />
                                             </svg>
                                             {feat.vote_count} votes
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

const styles = {
  content: {
    padding: 'var(--space-10) var(--space-8)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 'var(--space-10)'
  },
  breadcrumb: {
    fontSize: '0.625rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    letterSpacing: '0.1em',
    marginBottom: 'var(--space-2)'
  },
  h1: {
    fontSize: '2.25rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    letterSpacing: '-0.04em'
  },
  headerActions: {
    display: 'flex',
    gap: 'var(--space-3)'
  },
  syncBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: '10px 16px',
    backgroundColor: '#e5e7eb',
    color: 'var(--text-primary)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '600'
  },
  newFeatureBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: '10px 16px',
    backgroundColor: 'var(--gu-red)',
    color: '#ffffff',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '600',
    textDecoration: 'none'
  },
  btnIcon: {
    width: '18px',
    height: '18px'
  },
  filterBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-10)',
    gap: 'var(--space-4)'
  },
  searchWrapper: {
    position: 'relative',
    flex: 1,
    maxWidth: '540px'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    width: '18px',
    height: '18px',
    color: 'var(--text-muted)'
  },
  searchInput: {
    width: '100%',
    padding: '10px 10px 10px 40px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
    fontSize: '0.875rem',
    backgroundColor: '#ffffff'
  },
  viewToggleGroup: {
    display: 'flex',
    backgroundColor: '#f1f5f9',
    padding: '4px',
    borderRadius: 'var(--radius-md)',
    marginRight: '12px'
  },
  viewToggleBtn: {
    padding: '6px 14px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: 'transparent',
    border: 'none',
    transition: 'all 0.2s',
  },
  viewToggleBtnActive: {
    padding: '6px 14px',
    fontSize: '0.75rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    backgroundColor: '#ffffff',
    borderRadius: '4px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    cursor: 'pointer',
    border: 'none',
  },
  filterActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)'
  },
  filterLabel: {
    fontSize: '0.8125rem',
    color: 'var(--text-secondary)',
    fontWeight: '500'
  },
  select: {
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
    backgroundColor: '#ffffff',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--gu-red)'
  },
  iconBtn: {
    padding: '8px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
    color: 'var(--text-muted)'
  },
  kanbanContainer: {
    overflowX: 'auto',
    paddingBottom: 'var(--space-4)'
  },
  board: {
    display: 'flex',
    gap: 'var(--space-6)',
    minWidth: '1100px'
  },
  column: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
    backgroundColor: 'rgba(0, 0, 0, 0.03)',
    padding: 'var(--space-4)',
    borderRadius: 'var(--radius-lg)',
    minHeight: '600px'
  },
  columnHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 'var(--space-2)'
  },
  columnTitleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)'
  },
  columnDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%'
  },
  columnTitle: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  columnCount: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    backgroundColor: '#e5e7eb',
    padding: '1px 6px',
    borderRadius: '10px'
  },
  columnMoreBtn: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
  },
  columnCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)'
  },
  card: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-4)',
    textDecoration: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-3)',
    transition: 'all 0.1s ease',
    boxShadow: 'var(--shadow-sm)'
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  cardHeaderRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)'
  },
  priorityBadge: {
    fontSize: '0.625rem',
    fontWeight: '800',
    color: '#fff',
    padding: '1px 6px',
    borderRadius: '4px',
    textTransform: 'uppercase'
  },
  priorityColors: {
    'Critical': '#dc2626',
    'High': '#ea580c',
    'Medium': '#f59e0b',
    'Low': '#94a3b8'
  },
  cardTag: {
    fontSize: '0.625rem',
    fontWeight: '800',
    backgroundColor: '#f3f4f6',
    color: 'var(--text-secondary)',
    padding: '2px 6px',
    borderRadius: '4px'
  },
  pinTag: {
    fontSize: '0.75rem',
    color: 'var(--gu-gold)'
  },
  cardTitle: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    lineHeight: '1.4'
  },
  cardOwner: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-muted)',
    marginTop: '2px'
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginTop: 'var(--space-2)'
  },
  voteBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '0.75rem',
    fontWeight: '800',
    color: 'var(--gu-red)',
    backgroundColor: '#fff1f1',
    padding: '4px 8px',
    borderRadius: '6px',
    border: '1px solid #fee2e2'
  },
  voteIcon: {
    width: '12px',
    height: '12px'
  },
  message: {
    padding: 'var(--space-16)',
    textAlign: 'center',
    color: 'var(--text-muted)'
  },
  emptyContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '80px 20px',
    backgroundColor: '#f8fafc',
    borderRadius: 'var(--radius-xl)',
    border: '2px dashed #e2e8f0',
    textAlign: 'center',
    marginTop: 'var(--space-4)'
  },
  emptyIcon: {
    fontSize: '48px',
    marginBottom: 'var(--space-4)',
    filter: 'grayscale(1)',
    opacity: 0.5
  },
  emptyTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: 'var(--space-2)'
  },
  emptyText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    maxWidth: '400px',
    lineHeight: '1.6',
    marginBottom: 'var(--space-6)'
  },
  clearFiltersBtn: {
    padding: '10px 20px',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.875rem',
    fontWeight: '700',
    color: 'var(--gu-red)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    boxShadow: 'var(--shadow-sm)'
  }
};

export default AdminDashboardPage;
