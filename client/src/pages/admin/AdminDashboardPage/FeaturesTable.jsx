import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import styles from './FeaturesTable.module.css';

const DotScale = ({ value, color }) => {
  return (
    <div className={styles.dotScale}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className={styles.dot} style={{
          backgroundColor: i <= value ? color : '#e2e8f0',
        }} />
      ))}
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

const FeaturesTable = ({ features, stages, onUpdateFeatureField }) => {
  const [expandedGroups, setExpandedGroups] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'title', direction: 'asc' });

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
      const categoryName = feat.category_name || 'Uncategorized';
      if (!groups[categoryName]) {
        groups[categoryName] = {
          name: categoryName,
          color: feat.category_color || '#94a3b8',
          items: []
        };
      }
      groups[categoryName].items.push(feat);
    });
    
    Object.values(groups).forEach(group => {
      group.items.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        if (sortConfig.key === 'vote_count') {
          valA = Number(valA);
          valB = Number(valB);
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    });
    
    return Object.values(groups).sort((a, b) => a.name.localeCompare(b.name));
  }, [features, sortConfig]);

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
            <SortHeader label="Aa Summary" sortKey="title" width="30%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Release Stage" sortKey="status" width="12%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Priority" sortKey="priority" width="10%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Owner" sortKey="owner" width="12%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Stakeholder" sortKey="key_stakeholder" width="12%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Votes" sortKey="vote_count" width="8%" textAlign="center" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Impact" sortKey="impact" width="8%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Effort" sortKey="effort" width="8%" sortConfig={sortConfig} onSort={handleSort} />
          </tr>
        </thead>
        <tbody>
          {groupedFeatures.map(group => (
            <React.Fragment key={group.name}>
              {/* Group Header Row */}
              <tr className={styles.groupRow} onClick={() => toggleGroup(group.name)}>
                <td colSpan="8" className={styles.groupTd}>
                  <div className={styles.groupDiv}>
                    <svg 
                      className={styles.chevron} 
                      style={{ 
                        transform: isExpanded(group.name) ? 'rotate(90deg)' : 'rotate(0deg)' 
                      }} 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                    <span className={styles.groupDot} style={{backgroundColor: group.color}} />
                    <span className={styles.groupTitle}>{group.name}</span>
                    <span className={styles.groupCount}>{group.items.length} items</span>
                  </div>
                </td>
              </tr>
              
              {/* Feature Rows */}
              {isExpanded(group.name) && group.items.map(feat => (
                <tr key={feat.id} className={styles.featureRow}>
                  <td className={styles.td}>
                    <div className={styles.titleWrapper}>
                      <Link to={`/admin/features/${feat.id}/edit`} className={styles.titleLink}>
                        {feat.title}
                      </Link>
                      {feat.pinned === 1 && <span className={styles.pinIcon}>★</span>}
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
                  <td className={styles.td} style={{ textAlign: 'center' }}>
                    <div className={styles.voteWrapper}>
                      <span className={styles.voteText}>{feat.vote_count}</span>
                    </div>
                  </td>
                  <td className={styles.td}>
                    <DotScale value={feat.impact || 1} color="#10b981" />
                  </td>
                  <td className={styles.td}>
                    <DotScale value={feat.effort || 1} color="#f59e0b" />
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
          {groupedFeatures.length === 0 && (
            <tr>
              <td colSpan="8" className={styles.emptyCell}>
                No features found. Provide a wider search or add new features.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default FeaturesTable;
