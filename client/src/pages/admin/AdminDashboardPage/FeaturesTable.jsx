import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';

const DotScale = ({ value, color }) => {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          width: '8px', 
          height: '8px', 
          borderRadius: '50%',
          backgroundColor: i <= value ? color : '#e2e8f0',
          transition: 'background-color 0.2s ease'
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
      style={{
        appearance: 'none',
        padding: '4px 24px 4px 8px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.7rem',
        fontWeight: '800',
        backgroundColor: current.bg,
        color: current.color,
        border: 'none',
        cursor: 'pointer',
        outline: 'none',
        textTransform: 'uppercase',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(current.color)}' stroke-width='4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 6px center',
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
  
  // Create a soft background color from the hex
  const bg = `${current.color}15`; // 8% opacity for the select background

  return (
    <select 
      value={stageId || status} 
      onChange={(e) => onChange(e.target.value)}
      style={{
        appearance: 'none',
        padding: '4px 24px 4px 8px',
        borderRadius: 'var(--radius-sm)',
        fontSize: '0.75rem',
        fontWeight: '700',
        backgroundColor: bg,
        color: current.color,
        border: 'none',
        cursor: 'pointer',
        outline: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(current.color)}' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 6px center',
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
    
    // 1. Initial grouping
    features.forEach(feat => {
      const sectionName = feat.section_name || 'Uncategorized';
      if (!groups[sectionName]) {
        groups[sectionName] = {
          name: sectionName,
          color: feat.section_color || '#94a3b8',
          items: []
        };
      }
      groups[sectionName].items.push(feat);
    });
    
    // 2. Sort items within each group
    Object.values(groups).forEach(group => {
      group.items.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        
        // Handle special cases
        if (sortConfig.key === 'vote_count') {
          valA = Number(valA);
          valB = Number(valB);
        }

        if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    });
    
    // 3. Convert to sorted array of groups
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

  const SortHeader = ({ label, sortKey, width, textAlign = 'left' }) => {
    const isActive = sortConfig.key === sortKey;
    return (
      <th 
        style={{ ...styles.th, width, textAlign, cursor: 'pointer', userSelect: 'none' }}
        onClick={() => handleSort(sortKey)}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: textAlign === 'center' ? 'center' : 'flex-start', gap: '4px' }}>
          {label}
          <span style={{ fontSize: '10px', color: isActive ? 'var(--gu-red)' : '#cbd5e1' }}>
            {isActive ? (sortConfig.direction === 'asc' ? '▲' : '▼') : '↕'}
          </span>
        </div>
      </th>
    );
  };

  return (
    <div style={styles.tableContainer}>
      <table style={styles.table}>
        <thead>
          <tr>
            <SortHeader label="Aa Summary" sortKey="title" width="30%" />
            <SortHeader label="Release Stage" sortKey="status" width="12%" />
            <SortHeader label="Priority" sortKey="priority" width="10%" />
            <SortHeader label="Owner" sortKey="owner" width="12%" />
            <SortHeader label="Stakeholder" sortKey="key_stakeholder" width="12%" />
            <SortHeader label="Votes" sortKey="vote_count" width="8%" textAlign="center" />
            <SortHeader label="Impact" sortKey="impact" width="8%" />
            <SortHeader label="Effort" sortKey="effort" width="8%" />
          </tr>
        </thead>
        <tbody>
          {groupedFeatures.map(group => (
            <React.Fragment key={group.name}>
              {/* Group Header Row */}
              <tr style={styles.groupRow} onClick={() => toggleGroup(group.name)}>
                <td colSpan="8" style={styles.groupTd}>
                  <div style={styles.groupDiv}>
                    <svg 
                      style={{ 
                        ...styles.chevron, 
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
                    <span style={{...styles.groupDot, backgroundColor: group.color}} />
                    <span style={styles.groupTitle}>{group.name}</span>
                    <span style={styles.groupCount}>{group.items.length} items</span>
                  </div>
                </td>
              </tr>
              
              {/* Feature Rows */}
              {isExpanded(group.name) && group.items.map(feat => (
                <tr key={feat.id} style={styles.featureRow}>
                  <td style={styles.td}>
                    <div style={styles.titleWrapper}>
                      <Link to={`/admin/features/${feat.id}/edit`} style={styles.titleLink}>
                        {feat.title}
                      </Link>
                      {feat.pinned === 1 && <span style={styles.pinIcon}>★</span>}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <StatusSelect 
                      status={feat.status} 
                      stageId={feat.stage_id}
                      stages={stages}
                      onChange={(newStageId) => onUpdateFeatureField(feat.id, 'stage_id', newStageId)} 
                    />
                  </td>
                  <td style={styles.td}>
                    <PrioritySelect 
                      priority={feat.priority} 
                      onChange={(newVal) => onUpdateFeatureField(feat.id, 'priority', newVal)} 
                    />
                  </td>
                  <td style={styles.td}>
                    <div style={styles.ownerText}>{feat.owner || '--'}</div>
                  </td>
                  <td style={styles.td}>
                    <div style={styles.stakeholderText}>{feat.key_stakeholder || '--'}</div>
                  </td>
                  <td style={{ ...styles.td, textAlign: 'center' }}>
                    <div style={styles.voteWrapper}>
                      <span style={styles.voteText}>{feat.vote_count}</span>
                    </div>
                  </td>
                  <td style={styles.td}>
                    <DotScale value={feat.impact || 1} color="#10b981" />
                  </td>
                  <td style={styles.td}>
                    <DotScale value={feat.effort || 1} color="#f59e0b" />
                  </td>
                </tr>
              ))}
            </React.Fragment>
          ))}
          {groupedFeatures.length === 0 && (
            <tr>
              <td colSpan="8" style={styles.emptyCell}>
                No features found. Provide a wider search or add new features.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

const styles = {
  tableContainer: {
    width: '100%',
    overflowX: 'auto',
    backgroundColor: '#ffffff',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-sm)'
  },
  table: {
    width: '100%',
    minWidth: '800px',
    borderCollapse: 'collapse',
    textAlign: 'left'
  },
  th: {
    padding: '12px 16px',
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    borderBottom: '1px solid var(--border-color)',
    backgroundColor: '#fafafa',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  groupRow: {
    backgroundColor: '#f8fafc',
    cursor: 'pointer',
    userSelect: 'none',
    transition: 'background-color 0.2s',
    borderBottom: '1px solid var(--border-color)'
  },
  groupTd: {
    padding: '12px 16px',
  },
  groupDiv: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  chevron: {
    width: '16px',
    height: '16px',
    color: 'var(--text-secondary)',
    transition: 'transform 0.2s ease'
  },
  groupDot: {
    width: '12px',
    height: '12px',
    borderRadius: '4px',
  },
  groupTitle: {
    fontSize: '0.875rem',
    fontWeight: '800',
    color: 'var(--text-primary)'
  },
  groupCount: {
    fontSize: '0.75rem',
    fontWeight: '600',
    color: 'var(--text-muted)'
  },
  featureRow: {
    borderBottom: '1px solid #f1f5f9',
    transition: 'background-color 0.1s ease',
  },
  td: {
    padding: '12px 16px',
    verticalAlign: 'middle'
  },
  titleWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  },
  titleLink: {
    fontSize: '0.875rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    textDecoration: 'none',
    display: 'block',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  ownerText: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
  },
  stakeholderText: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
  },
  pinIcon: {
    color: 'var(--gu-gold)',
    fontSize: '0.875rem'
  },
  voteWrapper: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    padding: '2px 8px',
    borderRadius: '12px',
  },
  voteText: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary)'
  },
  emptyCell: {
    padding: '32px',
    textAlign: 'center',
    color: 'var(--text-muted)',
    fontSize: '0.875rem'
  }
};

export default FeaturesTable;
