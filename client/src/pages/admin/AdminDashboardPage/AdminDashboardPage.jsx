import { useEffect, useState, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../../components/AdminLayout';
import { getFeatures, updateFeature } from '../../../api/features';
import { getCategories } from '../../../api/categories';
import { getStages } from '../../../api/stages';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { useToast } from '../../../contexts/ToastContext';
import { useDebounce } from '../../../hooks/useDebounce';
import FeaturesTable from './FeaturesTable';
import styles from './AdminDashboardPage.module.css';

const AdminDashboardPage = () => {
  const { addToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [features, setFeatures] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stages, setStages] = useState([]);
  const [viewMode, setViewMode] = useState(() => {
    return localStorage.getItem('adminViewMode') || 'board';
  });
  const [loading, setLoading] = useState(true);

  // Filter state — initialised from URL params
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || '');
  const [selectedCategoryId, setSelectedCategoryId] = useState(searchParams.get('category') || '');
  const [selectedStatusId, setSelectedStatusId] = useState(searchParams.get('status') || '');
  const [selectedPriority, setSelectedPriority] = useState(searchParams.get('priority') || '');
  const [showAllStages, setShowAllStages] = useState(false);
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'default');
  const [groupBy, setGroupBy] = useState(searchParams.get('group') || 'category');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Save view selection to localStorage
  useEffect(() => {
    localStorage.setItem('adminViewMode', viewMode);
  }, [viewMode]);

  // Sync filter state → URL params (replace so we don't pollute back-stack)
  useEffect(() => {
    const params = {};
    if (debouncedSearchTerm) params.q = debouncedSearchTerm;
    if (selectedCategoryId) params.category = selectedCategoryId;
    if (selectedStatusId) params.status = selectedStatusId;
    if (selectedPriority) params.priority = selectedPriority;
    if (sortBy !== 'default') params.sort = sortBy;
    if (groupBy !== 'category') params.group = groupBy;
    setSearchParams(params, { replace: true });
  }, [debouncedSearchTerm, selectedCategoryId, selectedStatusId, selectedPriority, sortBy, groupBy]);

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
      const matchesSearch =
        !debouncedSearchTerm ||
        (f.title && f.title.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (f.owner && f.owner.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (f.category_name && f.category_name.toLowerCase().includes(debouncedSearchTerm.toLowerCase())) ||
        (Array.isArray(f.tags) && f.tags.join(' ').toLowerCase().includes(debouncedSearchTerm.toLowerCase()));

      const matchesCategory = !selectedCategoryId || f.category_id === selectedCategoryId;

      let matchesStatus = true;
      if (selectedStatusId === 'draft') {
        matchesStatus = f.is_published === 0;
      } else if (selectedStatusId) {
        matchesStatus = f.stage_id === selectedStatusId;
      }

      const matchesPriority = !selectedPriority || f.priority === selectedPriority;

      return matchesSearch && matchesCategory && matchesStatus && matchesPriority;
    });

    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'updated') return new Date(b.updated_at) - new Date(a.updated_at);
      if (sortBy === 'votes') return b.vote_count - a.vote_count;
      if (sortBy === 'gravity') return b.gravity_score - a.gravity_score;
      // Default: pinned first, then vote count, then creation date
      if (a.pinned !== b.pinned) return b.pinned - a.pinned;
      if (a.vote_count !== b.vote_count) return b.vote_count - a.vote_count;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return result;
  }, [features, debouncedSearchTerm, selectedCategoryId, selectedStatusId, selectedPriority, sortBy]);

  // Active filter chips — one chip per active non-default filter
  const activeFilters = useMemo(() => {
    const chips = [];
    if (debouncedSearchTerm) chips.push({
      key: 'search',
      label: `"${debouncedSearchTerm}"`,
      onRemove: () => setSearchTerm('')
    });
    if (selectedCategoryId) {
      const cat = categories.find(c => c.id === selectedCategoryId);
      chips.push({
        key: 'category',
        label: `Category: ${cat?.name || '…'}`,
        onRemove: () => setSelectedCategoryId('')
      });
    }
    if (selectedStatusId) {
      const label = selectedStatusId === 'draft'
        ? 'Drafts Only'
        : stages.find(s => s.id === selectedStatusId)?.name || '…';
      chips.push({
        key: 'status',
        label: `Stage: ${label}`,
        onRemove: () => setSelectedStatusId('')
      });
    }
    if (selectedPriority) chips.push({
      key: 'priority',
      label: `Priority: ${selectedPriority}`,
      onRemove: () => setSelectedPriority('')
    });
    return chips;
  }, [debouncedSearchTerm, selectedCategoryId, selectedStatusId, selectedPriority, categories, stages]);

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedCategoryId('');
    setSelectedStatusId('');
    setSelectedPriority('');
  };

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

  const resultCountText = filteredFeatures.length === features.length
    ? `${features.length} feature${features.length !== 1 ? 's' : ''}`
    : `${filteredFeatures.length} of ${features.length} features`;

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
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className={styles.filterActions}>
            {/* View toggle */}
            <div className={styles.viewToggleGroup}>
              <button
                className={viewMode === 'board' ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                onClick={() => setViewMode('board')}
              >
                Board
              </button>
              <button
                className={viewMode === 'list' ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                onClick={() => setViewMode('list')}
              >
                List
              </button>
            </div>

            {/* Stage visibility toggle */}
            <div className={styles.viewToggleGroup}>
              <button
                className={!showAllStages ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                onClick={() => setShowAllStages(false)}
                title="Show only visible stages"
              >
                Visible
              </button>
              <button
                className={showAllStages ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                onClick={() => setShowAllStages(true)}
                title="Show all stages including hidden"
              >
                All
              </button>
            </div>

            <div className={styles.filterDivider} />

            {/* Filter dropdowns */}
            <select
              className={styles.select}
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              title="Filter by category"
            >
              <option value="">All Categories</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            <select
              className={styles.select}
              value={selectedStatusId}
              onChange={(e) => setSelectedStatusId(e.target.value)}
              title="Filter by stage"
            >
              <option value="">Any Stage</option>
              <option value="draft">Drafts Only</option>
              {stages.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select
              className={styles.select}
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              title="Filter by priority"
            >
              <option value="">Any Priority</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>

            {/* Sort — board view only (table uses column headers) */}
            {viewMode === 'board' && (
              <select
                className={styles.select}
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                title="Sort order"
              >
                <option value="default">Default Order</option>
                <option value="updated">Recently Modified</option>
                <option value="newest">Newest First</option>
                <option value="votes">Most Votes</option>
                <option value="gravity">Highest Gravity</option>
              </select>
            )}

            {/* Group by — list view only */}
            {viewMode === 'list' && (
              <div className={styles.viewToggleGroup}>
                <button
                  className={groupBy === 'category' ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                  onClick={() => setGroupBy('category')}
                >
                  Category
                </button>
                <button
                  className={groupBy === 'status' ? styles.viewToggleBtnActive : styles.viewToggleBtn}
                  onClick={() => setGroupBy('status')}
                >
                  Status
                </button>
              </div>
            )}

            <span className={styles.resultCount}>{resultCountText}</span>
          </div>
        </div>

        {/* Active filter chips */}
        {activeFilters.length > 0 && (
          <div className={styles.activeFiltersRow}>
            {activeFilters.map(chip => (
              <span key={chip.key} className={styles.filterChip}>
                {chip.label}
                <button className={styles.filterChipRemove} onClick={chip.onRemove} aria-label={`Remove ${chip.key} filter`}>×</button>
              </span>
            ))}
            <button className={styles.clearAllBtn} onClick={clearAllFilters}>
              Clear all
            </button>
          </div>
        )}

        {/* Kanban Board / Table */}
        <div className={styles.kanbanContainer}>
          {loading ? (
            <div className={styles.message}>Loading roadmap board...</div>
          ) : filteredFeatures.length === 0 && activeFilters.length > 0 ? (
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
                      style={{ backgroundColor: `${col.color}0D` }}
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
                                      <div className={styles.cardUpdatedDate}>
                                        Updated {new Date(feat.updated_at).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
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
