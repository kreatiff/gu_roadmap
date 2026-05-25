import { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Plus, Search, X } from 'lucide-react';
import AdminLayout from '../../../components/AdminLayout';
import VerifiedBadge from '../../../components/VerifiedBadge';
import FilterDropdown from '../../../components/FilterDropdown/FilterDropdown';
import MultiSelectFilter from '../../../components/MultiSelectFilter/MultiSelectFilter';
import { getFeatures, updateFeature, updateStageSortOrders } from '../../../api/features';
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

  const readPrefs = () => {
    try {
      return JSON.parse(localStorage.getItem('adminDashboardPrefs') || '{}');
    } catch {
      return {};
    }
  };

  const writePrefs = (prefs) => {
    localStorage.setItem('adminDashboardPrefs', JSON.stringify(prefs));
  };

  const savedPrefs = readPrefs();

  const [features, setFeatures] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stages, setStages] = useState([]);
  const [viewMode, setViewMode] = useState(() => {
    return savedPrefs.viewMode || localStorage.getItem('adminViewMode') || 'board';
  });
  const [loading, setLoading] = useState(true);

  // Filter state — initialised from URL params first, then localStorage pref fallback
  const [searchTerm, setSearchTerm] = useState(searchParams.get('q') || savedPrefs.searchTerm || '');
  // Multi-select filters (arrays)
  const parseArrayParam = (param) => param ? param.split(',') : [];
  const [selectedCategories, setSelectedCategories] = useState(
    parseArrayParam(searchParams.get('category')) || savedPrefs.selectedCategories || []
  );
  const [selectedStatuses, setSelectedStatuses] = useState(
    parseArrayParam(searchParams.get('status')) || savedPrefs.selectedStatuses || []
  );
  const [selectedPriorities, setSelectedPriorities] = useState(
    parseArrayParam(searchParams.get('priority')) || savedPrefs.selectedPriorities || []
  );
  const [selectedReviewed, setSelectedReviewed] = useState(searchParams.get('reviewed') || savedPrefs.selectedReviewed || '');
  const [showAllStages, setShowAllStages] = useState(() => {
    return savedPrefs.showAllStages !== undefined ? savedPrefs.showAllStages : false;
  });
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || savedPrefs.sortBy || 'order');
  const [groupBy, setGroupBy] = useState(searchParams.get('group') || savedPrefs.groupBy || 'category');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Persist all preferences to localStorage
  useEffect(() => {
    writePrefs({
      viewMode,
      searchTerm,
      selectedCategories,
      selectedStatuses,
      selectedPriorities,
      selectedReviewed,
      showAllStages,
      sortBy,
      groupBy,
    });
  }, [viewMode, searchTerm, selectedCategories, selectedStatuses, selectedPriorities, selectedReviewed, showAllStages, sortBy, groupBy]);

  // Sync filter state → URL params (replace so we don't pollute back-stack)
  useEffect(() => {
    const params = {};
    if (debouncedSearchTerm) params.q = debouncedSearchTerm;
    if (selectedCategories.length > 0) params.category = selectedCategories.join(',');
    if (selectedStatuses.length > 0) params.status = selectedStatuses.join(',');
    if (selectedPriorities.length > 0) params.priority = selectedPriorities.join(',');
    if (selectedReviewed) params.reviewed = selectedReviewed;
    if (sortBy !== 'default') params.sort = sortBy;
    if (groupBy !== 'category') params.group = groupBy;
    setSearchParams(params, { replace: true });
  }, [debouncedSearchTerm, selectedCategories, selectedStatuses, selectedPriorities, selectedReviewed, sortBy, groupBy]);

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

      const matchesCategory = selectedCategories.length === 0 || selectedCategories.includes(f.category_id);

      let matchesStatus = true;
      if (selectedStatuses.length > 0) {
        if (selectedStatuses.includes('draft')) {
          matchesStatus = !f.is_published;
        } else {
          matchesStatus = selectedStatuses.includes(f.stage_id);
        }
      }

      const matchesPriority = selectedPriorities.length === 0 || selectedPriorities.includes(f.priority);

      const matchesReviewed = !selectedReviewed || (selectedReviewed === 'true' ? !!f.is_reviewed : !f.is_reviewed);

      return matchesSearch && matchesCategory && matchesStatus && matchesPriority && matchesReviewed;
    });

    // Apply sorting
    result.sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.created_at) - new Date(a.created_at);
      if (sortBy === 'updated') return new Date(b.updated_at) - new Date(a.updated_at);
      if (sortBy === 'gravity') return b.gravity_score - a.gravity_score;
      if (sortBy === 'order') {
        const aOrder = a.stage_sort_order ?? 0;
        const bOrder = b.stage_sort_order ?? 0;
        if (aOrder !== bOrder) return aOrder - bOrder;
      }
      // Default: pinned first, then creation date
      if (a.pinned !== b.pinned) return b.pinned - a.pinned;
      return new Date(b.created_at) - new Date(a.created_at);
    });

    return result;
  }, [features, debouncedSearchTerm, selectedCategories, selectedStatuses, selectedPriorities, selectedReviewed, sortBy]);

  // Active filter chips — one chip per active non-default filter
  const activeFilters = useMemo(() => {
    const chips = [];
    if (debouncedSearchTerm) chips.push({
      key: 'search',
      label: `Search: "${debouncedSearchTerm}"`,
      onRemove: () => setSearchTerm('')
    });
    selectedCategories.forEach(catId => {
      const cat = categories.find(c => c.id === catId);
      chips.push({
        key: `category-${catId}`,
        label: `Category: ${cat?.name || catId}`,
        onRemove: () => setSelectedCategories(prev => prev.filter(id => id !== catId))
      });
    });
    selectedStatuses.forEach(statusId => {
      const label = statusId === 'draft'
        ? 'Drafts Only'
        : stages.find(s => s.id === statusId)?.name || statusId;
      chips.push({
        key: `status-${statusId}`,
        label: `Stage: ${label}`,
        onRemove: () => setSelectedStatuses(prev => prev.filter(id => id !== statusId))
      });
    });
    selectedPriorities.forEach(priority => {
      chips.push({
        key: `priority-${priority}`,
        label: `Priority: ${priority}`,
        onRemove: () => setSelectedPriorities(prev => prev.filter(p => p !== priority))
      });
    });
    if (selectedReviewed) chips.push({
      key: 'reviewed',
      label: selectedReviewed === 'true' ? 'Reviewed' : 'Not Reviewed',
      onRemove: () => setSelectedReviewed('')
    });
    return chips;
  }, [debouncedSearchTerm, selectedCategories, selectedStatuses, selectedPriorities, selectedReviewed, categories, stages]);

  const clearAllFilters = () => {
    setSearchTerm('');
    setSelectedCategories([]);
    setSelectedStatuses([]);
    setSelectedPriorities([]);
    setSelectedReviewed('');
  };

  const columnsData = useMemo(() => {
    const map = {};
    stages.forEach(s => {
      map[s.id] = filteredFeatures.filter(f => f.stage_id === s.id || (f.stage_id === null && f.stage_slug === s.slug));
    });
    return map;
  }, [filteredFeatures, stages]);

  const columns = useMemo(() => {
    return showAllStages ? stages : stages.filter(s => s.is_visible);
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

  const handleFeatureReorder = useCallback((reorderedItems) => {
    if (!reorderedItems) {
      fetchFeatures();
      return;
    }
    setFeatures(prev => {
      const newFeatures = [...prev];
      reorderedItems.forEach(({ id, stage_sort_order }) => {
        const idx = newFeatures.findIndex(f => f.id.toString() === id.toString());
        if (idx !== -1) {
          newFeatures[idx] = { ...newFeatures[idx], stage_sort_order };
        }
      });
      return newFeatures;
    });
  }, []);

  const onDragEnd = async (result) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const draggableIdStr = draggableId.toString();
    const sourceIdx = features.findIndex(f => f.id.toString() === draggableIdStr);
    if (sourceIdx === -1) return;

    const oldFeature = features[sourceIdx];
    const isCrossColumn = destination.droppableId !== source.droppableId;

    if (isCrossColumn) {
      // Cross-column: move feature to new stage + insert at destination index
      const newStageId = destination.droppableId;
      const destStage = stages.find(s => s.id === newStageId);

      // Compute new stage_sort_order for insertion at destination.index in the new column
      const destColFeatures = (columnsData[newStageId] || [])
        .filter(f => f.id.toString() !== draggableIdStr)
        .sort((a, b) => (a.stage_sort_order ?? 0) - (b.stage_sort_order ?? 0));

      let newSortOrder;
      if (destColFeatures.length === 0) {
        newSortOrder = 1000;
      } else if (destination.index === 0) {
        newSortOrder = (destColFeatures[0].stage_sort_order ?? 0) - 1000;
      } else if (destination.index >= destColFeatures.length) {
        newSortOrder = (destColFeatures[destColFeatures.length - 1].stage_sort_order ?? 0) + 1000;
      } else {
        const prevOrder = destColFeatures[destination.index - 1].stage_sort_order ?? 0;
        const nextOrder = destColFeatures[destination.index].stage_sort_order ?? 0;
        newSortOrder = Math.round((prevOrder + nextOrder) / 2);
      }

      const newFeatures = [...features];
      newFeatures[sourceIdx] = {
        ...oldFeature,
        stage_id: newStageId,
        stage_name: destStage?.name || oldFeature.stage_name,
        stage_color: destStage?.color || oldFeature.stage_color,
        stage_slug: destStage?.slug || oldFeature.stage_slug,
        status: destStage?.slug || oldFeature.status,
        stage_sort_order: newSortOrder,
      };
      setFeatures(newFeatures);

      try {
        await updateFeature(draggableIdStr, {
          stage_id: newStageId,
          status: destStage?.slug,
          stage_sort_order: newSortOrder,
        });
        addToast(`Moved to ${destStage?.name || 'new stage'}`, 'success');
      } catch {
        addToast('Failed to move feature', 'error');
        fetchFeatures();
      }
    } else {
      // Within-column: reorder — update stage_sort_order for all features in the column
      const stageId = destination.droppableId;
      const colFeatures = [...(columnsData[stageId] || [])];

      // Remove the dragged item from its original position
      const [dragged] = colFeatures.splice(source.index, 1);
      // Insert at destination index
      colFeatures.splice(destination.index, 0, dragged);

      // Assign gap-based sort orders: 1000, 2000, 3000, ...
      const reordered = colFeatures.map((f, i) => ({
        id: f.id,
        stage_sort_order: (i + 1) * 1000,
      }));

      // Optimistically update local state
      const newFeatures = [...features];
      reordered.forEach(({ id, stage_sort_order }) => {
        const idx = newFeatures.findIndex(f => f.id.toString() === id.toString());
        if (idx !== -1) {
          newFeatures[idx] = { ...newFeatures[idx], stage_sort_order };
        }
      });
      setFeatures(newFeatures);

      try {
        await updateStageSortOrders(reordered);
      } catch {
        addToast('Failed to reorder features', 'error');
        fetchFeatures();
      }
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
            <h1 className={styles.h1}>Roadmap Editor</h1>
          </div>
          <div className={styles.headerActions}>
            <Link to="/admin/features/new" className={styles.newFeatureBtn}>
              <Plus size={16} strokeWidth={2} className={styles.btnIcon} />
              New Feature
            </Link>
          </div>
        </header>

        {/* Filter section: bar + chips */}
        <div className={styles.filterSection}>
        <div className={styles.filterBar}>
          <div className={styles.searchWrapper}>
            <Search size={16} strokeWidth={2} className={styles.searchIcon} />
            <input
              type="text"
              placeholder="Search by title, owner, or #tags..."
              className={styles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button className={styles.searchClearBtn} onClick={() => setSearchTerm('')} aria-label="Clear search">
                <X size={14} />
              </button>
            )}
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

            {/* Multiselect dropdowns */}
            <FilterDropdown
              label="Categories"
              selectedCount={selectedCategories.length}
              type="category"
            >
              <MultiSelectFilter
                options={categories.map(c => ({ id: c.id, label: c.name }))}
                selectedValues={selectedCategories}
                onChange={setSelectedCategories}
              />
            </FilterDropdown>

            <FilterDropdown
              label="Stages"
              selectedCount={selectedStatuses.length}
              type="status"
            >
              <MultiSelectFilter
                options={[
                  { id: 'draft', label: 'Drafts Only' },
                  ...stages.map(s => ({ id: s.id, label: s.name }))
                ]}
                selectedValues={selectedStatuses}
                onChange={setSelectedStatuses}
              />
            </FilterDropdown>

            <FilterDropdown
              label="Priority"
              selectedCount={selectedPriorities.length}
              type="priority"
            >
              <MultiSelectFilter
                options={[
                  { id: 'Critical', label: 'Critical' },
                  { id: 'High', label: 'High' },
                  { id: 'Medium', label: 'Medium' },
                  { id: 'Low', label: 'Low' },
                ]}
                selectedValues={selectedPriorities}
                onChange={setSelectedPriorities}
              />
            </FilterDropdown>

            <FilterDropdown
                label="Review"
                selectedCount={selectedReviewed ? 1 : 0}
                type="review"
              >
                <div className={styles.selectList}>
                  <button
                    className={`${styles.selectOption} ${selectedReviewed === '' ? styles.selectOptionActive : ''}`}
                    onClick={() => setSelectedReviewed('')}
                    type="button"
                  >
                    All Review Status
                  </button>
                  <button
                    className={`${styles.selectOption} ${selectedReviewed === 'true' ? styles.selectOptionActive : ''}`}
                    onClick={() => setSelectedReviewed('true')}
                    type="button"
                  >
                    Reviewed
                  </button>
                  <button
                    className={`${styles.selectOption} ${selectedReviewed === 'false' ? styles.selectOptionActive : ''}`}
                    onClick={() => setSelectedReviewed('false')}
                    type="button"
                  >
                    Not Reviewed
                  </button>
                </div>
              </FilterDropdown>

              {/* Sort — board view only (table uses column headers) */}
              {viewMode === 'board' && (
                <FilterDropdown
                  label="Sort"
                  selectedCount={sortBy !== 'order' ? 1 : 0}
                  type="sort"
                >
                  <div className={styles.selectList}>
                    <button className={`${styles.selectOption} ${sortBy === 'order' ? styles.selectOptionActive : ''}`} onClick={() => setSortBy('order')} type="button">Manual Order</button>
                    <button className={`${styles.selectOption} ${sortBy === 'default' ? styles.selectOptionActive : ''}`} onClick={() => setSortBy('default')} type="button">Default Order</button>
                    <button className={`${styles.selectOption} ${sortBy === 'updated' ? styles.selectOptionActive : ''}`} onClick={() => setSortBy('updated')} type="button">Recently Modified</button>
                    <button className={`${styles.selectOption} ${sortBy === 'newest' ? styles.selectOptionActive : ''}`} onClick={() => setSortBy('newest')} type="button">Newest First</button>
                    <button className={`${styles.selectOption} ${sortBy === 'gravity' ? styles.selectOptionActive : ''}`} onClick={() => setSortBy('gravity')} type="button">Highest Gravity</button>
                  </div>
                </FilterDropdown>
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
                <button className={styles.filterChipRemove} onClick={chip.onRemove} aria-label={`Remove ${chip.key} filter`}>
                  <X size={12} />
                </button>
              </span>
            ))}
            <button className={styles.clearAllBtn} onClick={clearAllFilters}>
              Clear all
            </button>
          </div>
        )}
        </div>{/* end filterSection */}

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
              onReorder={handleFeatureReorder}
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
                                    <div className={styles.cardBody} onClick={() => {
                                      if (!snapshot.isDragging) {
                                        window.location.href = `/admin/features/${feat.id}/edit`;
                                      }
                                    }}>
                                      <div className={styles.cardHeader}>
                                        <span className={styles.cardTag}>{feat.category_name || 'GENERAL'}</span>
                                        <div className={styles.cardHeaderRight}>
                                          {feat.is_reviewed && <VerifiedBadge size={22} className={styles.reviewedBadge} />}
                                          {!feat.is_published && <span className={styles.draftBadgeBadge}>DRAFT</span>}
                                          <span className={`${styles.priorityBadge} ${priorityClasses[feat.priority] || ''}`}>
                                            {feat.priority}
                                          </span>
                                          {feat.pinned && <span className={styles.pinIcon}>★</span>}
                                        </div>
                                      </div>
                                      <h4 className={styles.cardTitle}>{feat.title}</h4>
                                      {feat.owner && <div className={styles.cardOwner}>Owner: {feat.owner}</div>}
                                        <div className={styles.cardFooter}>
                                           <div className={styles.cardUpdatedDate}>
                                             Updated {new Date(feat.updated_at).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
                                           </div>
                                            <div className={styles.cardMetrics}>
                                              <div className={`${styles.gravityBadge} ${
                                                (feat.gravity_score || 0) >= 75 ? styles.gravityHigh :
                                                (feat.gravity_score || 0) >= 50 ? styles.gravityMid :
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
