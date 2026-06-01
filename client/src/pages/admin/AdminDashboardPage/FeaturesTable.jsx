import React, { useState, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import VerifiedBadge from '../../../components/VerifiedBadge';
import { updateStageSortOrders } from '../../../api/features';
import styles from './FeaturesTable.module.css';

const DotScale = ({ value, color }) => {
  return (
    <div className={styles.dotScale}>
      {Array.from({ length: 10 }, (_, i) => i + 1).map(i => (
        <div key={i} className={styles.dot} style={{
          backgroundColor: i <= value ? color : '#e2e8f0',
        }} />
      ))}
    </div>
  );
};

const GravityBadge = ({ score }) => {
  let colorClass = styles.gravityLow;
  if (score >= 75) colorClass = styles.gravityHigh;
  else if (score >= 50) colorClass = styles.gravityMid;

  return (
    <div className={`${styles.gravityBadge} ${colorClass}`}>
      <span className={styles.gravityIcon}>⚡</span>
      {score}
    </div>
  );
};

const PrioritySelect = ({ priority, onChange }) => {
  const options = [
    { value: 'Low', label: 'Low', bg: '#f1f5f9', color: '#64748b' },
    { value: 'Medium', label: 'Medium', bg: '#fef3c7', color: '#92400e' },
    { value: 'High', label: 'High', bg: '#ffedd5', color: '#ea580c' },
    { value: 'Critical', label: 'Critical', bg: '#fee2e2', color: '#dc2626' }
  ];
  
  const current = options.find(o => o.value === priority) || options[1];

  return (
    <select 
      value={priority} 
      onChange={(e) => onChange(e.target.value)}
      className={styles.prioritySelect}
      style={{
        backgroundColor: current.bg,
        color: current.color,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(current.color)}' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
      }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value} style={{ backgroundColor: '#fff', color: '#000' }}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};

const StatusSelect = ({ status, stageId, stages, onChange }) => {
  const current = stages.find(s => s.id === stageId || s.slug === status) || stages[0] || { name: 'Unknown', color: '#64748b' };
  const bg = `${current.color}15`; 

  return (
    <select 
      value={stageId || status} 
      onChange={(e) => onChange(e.target.value)}
      className={styles.statusSelect}
      style={{
        backgroundColor: bg,
        color: current.color,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(current.color)}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
      }}
    >
      {stages.map(opt => (
        <option key={opt.id} value={opt.id} style={{ backgroundColor: '#fff', color: '#000' }}>
          {opt.name}
        </option>
      ))}
    </select>
  );
};

const SortHeader = ({ label, sortKey, width, textAlign = 'left', sortConfig, onSort }) => {
  const isActive = sortConfig.key === sortKey;
  return (
    <th 
      className={styles.th} 
      style={{ width, textAlign }}
      onClick={() => onSort(sortKey)}
    >
      <div className={styles.thContent} style={{ justifyContent: textAlign === 'center' ? 'center' : 'flex-start' }}>
        {label}
        <span className={styles.sortIcon} style={{ color: isActive ? 'var(--gu-red)' : '#cbd5e1' }}>
          {isActive ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
        </span>
      </div>
    </th>
  );
};

const FeaturesTable = ({ features, stages, onUpdateFeatureField, groupBy = 'category', onReorder }) => {

  const isReorderable = groupBy === 'status';

  const [expandedGroups, setExpandedGroups] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'stage_sort_order', direction: 'asc' });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Group and sort features
  const groupedFeatures = useMemo(() => {
    const groups = {};
    
    features.forEach(feat => {
      let groupKey, groupName, groupColor, groupOrder;

      if (groupBy === 'status') {
        groupKey = feat.stage_id || feat.status || 'unknown';
        const stage = stages.find(s => s.id === groupKey || s.slug === groupKey);
        groupName = stage?.name || 'Unknown Status';
        groupColor = stage?.color || '#94a3b8';
        groupOrder = stage?.order_idx ?? 999;
      } else {
        // Group by Category
        groupKey = feat.category_name || 'Uncategorized';
        groupName = groupKey;
        groupColor = feat.category_color || '#94a3b8';
        groupOrder = groupName; // alphabetical
      }

      if (!groups[groupKey]) {
        groups[groupKey] = {
          name: groupName,
          color: groupColor,
          order: groupOrder,
          items: []
        };
      }
      groups[groupKey].items.push(feat);
    });

    const sortedGroups = Object.values(groups).sort((a, b) => {
      if (typeof a.order === 'number' && typeof b.order === 'number') {
        return a.order - b.order;
      }
      return String(a.order).localeCompare(String(b.order));
    });
    
    sortedGroups.forEach(group => {

      group.items.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        if (sortConfig.key === 'gravity_score' || sortConfig.key === 'impact' || sortConfig.key === 'effort' || sortConfig.key === 'stage_sort_order') {
          valA = Number(valA);
          valB = Number(valB);
        } else if (sortConfig.key === 'updated_at') {
          valA = new Date(valA || 0).getTime();
          valB = new Date(valB || 0).getTime();
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;

        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    });
    
    return sortedGroups;
  }, [features, sortConfig, groupBy, stages]);

  const handleDragEnd = useCallback(async (result) => {
    const { destination, source } = result;
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    if (destination.droppableId !== source.droppableId) return;

    const groupKey = destination.droppableId;
    const group = groupedFeatures.find(g => g.name === groupKey);
    if (!group) return;

    const items = [...group.items];
    const [dragged] = items.splice(source.index, 1);
    items.splice(destination.index, 0, dragged);

    const reordered = items.map((f, i) => ({
      id: f.id,
      stage_sort_order: (i + 1) * 1000,
    }));

    if (onReorder) {
      onReorder(reordered);
    }
    setSortConfig({ key: 'stage_sort_order', direction: 'asc' });

    try {
      await updateStageSortOrders(reordered);
    } catch (err) {
      console.error('Failed to reorder:', err);
      if (onReorder) {
        onReorder(null);
      }
    }
  }, [groupedFeatures, onReorder]);

  const toggleGroup = (groupName) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupName]: prev[groupName] !== undefined ? !prev[groupName] : false 
    }));
  };

  const isExpanded = (groupName) => {
    return expandedGroups[groupName] !== false; 
  };


  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            {isReorderable && <th className={styles.th} style={{ width: '32px' }} />}
            <SortHeader label="#" sortKey="stage_sort_order" width="2%" textAlign="center" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Aa Summary" sortKey="title" width="28%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Release Stage" sortKey="status" width="12%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Priority" sortKey="priority" width="10%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Owner" sortKey="owner" width="12%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Stakeholder" sortKey="key_stakeholder" width="12%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Impact" sortKey="impact" width="8%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Effort" sortKey="effort" width="8%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Updated" sortKey="updated_at" width="10%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Gravity" sortKey="gravity_score" width="10%" textAlign="center" sortConfig={sortConfig} onSort={handleSort} />
          </tr>
        </thead>
        {groupedFeatures.map(group => (
          <React.Fragment key={group.name}>
            <tbody>
              <tr className={styles.groupRow} onClick={() => toggleGroup(group.name)}>
                <td colSpan={isReorderable ? 11 : 10} className={styles.groupTd}>
                  <div className={styles.groupDiv}>
                    <ChevronRight
                      size={16}
                      style={{
                        transform: isExpanded(group.name) ? 'rotate(90deg)' : 'rotate(0deg)'
                      }}
                    />
                    <span className={styles.groupDot} style={{backgroundColor: group.color}} />
                    <span className={styles.groupTitle}>{group.name}</span>
                    <span className={styles.groupCount}>{group.items.length} items</span>
                  </div>
                </td>
              </tr>
            </tbody>
            {isExpanded(group.name) && (isReorderable ? (
              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId={group.name}>
                  {(provided) => (
                    <tbody ref={provided.innerRef} {...provided.droppableProps}>
                      {group.items.map((feat, index) => (
                        <Draggable key={feat.id.toString()} draggableId={feat.id.toString()} index={index}>
                          {(provided, snapshot) => (
                            <tr
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`${styles.featureRow} ${snapshot.isDragging ? styles.dragging : ''}`}
                              style={provided.draggableProps.style}
                            >
                              <td className={styles.td} style={{ width: '32px', padding: '4px' }}>
                                <div
                                  {...provided.dragHandleProps}
                                  className={styles.dragHandle}
                                  title="Drag to reorder"
                                >
                                  <GripVertical size={12} strokeWidth={2.5} />
                                </div>
                              </td>
                              <td className={styles.td} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                {feat.stage_sort_order ? Math.round(feat.stage_sort_order / 1000) : '--'}
                              </td>
                              <td className={styles.td}>
                                <div className={styles.titleWrapper}>
                                  <Link to={`/admin/features/${feat.id}/edit`} className={styles.titleLink}>
                                    {feat.title}
                                  </Link>
                                  {!feat.is_published && <span className={styles.draftBadgeBadge}>DRAFT</span>}
                                  {feat.pinned && <span className={styles.pinIcon}>★</span>}
                                  {feat.is_reviewed && <VerifiedBadge size={22} className={styles.reviewedBadge} title="Reviewed" />}
                                </div>
                              </td>
                              <td className={styles.td}>
                                <StatusSelect 
                                  status={feat.status} 
                                  stageId={feat.stage_id}
                                  stages={stages}
                                  onChange={(newStageId) => onUpdateFeatureField(feat.id, 'stage_id', newStageId)} 
                                />
                              </td>
                              <td className={styles.td}>
                                <PrioritySelect 
                                  priority={feat.priority} 
                                  onChange={(newVal) => onUpdateFeatureField(feat.id, 'priority', newVal)} 
                                />
                              </td>
                              <td className={styles.td}>
                                <div className={styles.ownerText}>{feat.owner || '--'}</div>
                              </td>
                              <td className={styles.td}>
                                <div className={styles.stakeholderText}>{feat.key_stakeholder || '--'}</div>
                              </td>
                              <td className={styles.td}>
                                <DotScale value={feat.impact || 1} color="#10b981" />
                              </td>
                              <td className={styles.td}>
                                <DotScale value={feat.effort || 1} color="#f59e0b" />
                              </td>
                              <td className={styles.td}>
                                <div className={styles.dateText}>
                                  {new Date(feat.updated_at).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                                </div>
                              </td>
                              <td className={styles.td} style={{ textAlign: 'center' }}>
                                <GravityBadge score={feat.gravity_score || 0} />
                              </td>
                            </tr>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </tbody>
                  )}
                </Droppable>
              </DragDropContext>
            ) : (
              <tbody>
                {group.items.map(feat => (
                  <tr key={feat.id} className={styles.featureRow}>
                  <td className={styles.td} style={{ textAlign: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                    {feat.stage_sort_order ? Math.round(feat.stage_sort_order / 1000) : '--'}
                  </td>
                  <td className={styles.td}>
                    <div className={styles.titleWrapper}>
                      <Link to={`/admin/features/${feat.id}/edit`} className={styles.titleLink}>
                        {feat.title}
                      </Link>
                      {!feat.is_published && <span className={styles.draftBadgeBadge}>DRAFT</span>}
                      {feat.pinned && <span className={styles.pinIcon}>★</span>}
                      {feat.is_reviewed && <VerifiedBadge size={22} className={styles.reviewedBadge} title="Reviewed" />}
                    </div>
                  </td>
                  <td className={styles.td}>
                    <StatusSelect 
                      status={feat.status} 
                      stageId={feat.stage_id}
                      stages={stages}
                      onChange={(newStageId) => onUpdateFeatureField(feat.id, 'stage_id', newStageId)} 
                    />
                  </td>
                  <td className={styles.td}>
                    <PrioritySelect 
                      priority={feat.priority} 
                      onChange={(newVal) => onUpdateFeatureField(feat.id, 'priority', newVal)} 
                    />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.ownerText}>{feat.owner || '--'}</div>
                  </td>
                  <td className={styles.td}>
                    <div className={styles.stakeholderText}>{feat.key_stakeholder || '--'}</div>
                  </td>
                  <td className={styles.td}>
                    <DotScale value={feat.impact || 1} color="#10b981" />
                  </td>
                  <td className={styles.td}>
                    <DotScale value={feat.effort || 1} color="#f59e0b" />
                  </td>
                  <td className={styles.td}>
                    <div className={styles.dateText}>
                      {new Date(feat.updated_at).toLocaleDateString('en-AU', { month: 'short', day: 'numeric' })}
                    </div>
                  </td>
                  <td className={styles.td} style={{ textAlign: 'center' }}>
                    <GravityBadge score={feat.gravity_score || 0} />
                  </td>
                </tr>
              ))}
              </tbody>
            ))}
          </React.Fragment>
        ))}
        {groupedFeatures.length === 0 && (
          <tbody>
            <tr>
              <td colSpan={isReorderable ? 11 : 10} className={styles.emptyCell}>
                No features found. Provide a wider search or add new features.
              </td>
            </tr>
          </tbody>
        )}
      </table>
    </div>
  );
};

export default FeaturesTable;
