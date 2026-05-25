import { useState, useMemo } from 'react';
import StatusBadge from '../StatusBadge';
import CategoryIcon from '../CategoryIcon';
import VerifiedBadge from '../VerifiedBadge';
import styles from './PublicTableView.module.css';

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

const SortHeader = ({ label, sortKey, width, textAlign = 'left', sortConfig, onSort }) => {
  const isActive = sortConfig.key === sortKey;
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSort(sortKey);
    }
  };
  return (
    <th
      className={styles.th}
      style={{ width, textAlign }}
      tabIndex={0}
      onClick={() => onSort(sortKey)}
      onKeyDown={handleKeyDown}
      aria-sort={isActive ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      role="columnheader"
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

const PublicTableView = ({ features, onFeatureClick }) => {
  const [sortConfig, setSortConfig] = useState({ key: 'stage_sort_order', direction: 'asc' });

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const sortedFeatures = useMemo(() => {
    const sorted = [...features];
    sorted.sort((a, b) => {
      let valA = a[sortConfig.key];
      let valB = b[sortConfig.key];

      if (sortConfig.key === 'gravity_score' || sortConfig.key === 'stage_sort_order') {
        valA = Number(valA) || 0;
        valB = Number(valB) || 0;
      } else if (sortConfig.key === 'updated_at') {
        valA = new Date(valA || 0).getTime();
        valB = new Date(valB || 0).getTime();
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return sortConfig.direction === 'asc' ? -1 : 1;
      if (valA > valB) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [features, sortConfig]);

  const handleRowKeyDown = (e, featureId) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onFeatureClick(featureId);
    }
  };

  if (sortedFeatures.length === 0) {
    return (
      <div className={styles.emptyContainer}>
        <div className={styles.emptyIcon}>🔍</div>
        <h3 className={styles.emptyTitle}>No matching features found</h3>
        <p className={styles.emptyText}>Adjust your filters or search terms to find what you're looking for.</p>
      </div>
    );
  }

  return (
    <div className={styles.tableContainer}>
      <table className={styles.table}>
        <thead>
          <tr>
            <SortHeader label="Title" sortKey="title" width="30%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Stage" sortKey="stage_name" width="14%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Category" sortKey="category_name" width="18%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Updated" sortKey="updated_at" width="10%" sortConfig={sortConfig} onSort={handleSort} />
            <SortHeader label="Gravity" sortKey="gravity_score" width="10%" textAlign="center" sortConfig={sortConfig} onSort={handleSort} />
          </tr>
        </thead>
        <tbody>
          {sortedFeatures.map(feat => (
            <tr
              key={feat.id}
              className={styles.featureRow}
              onClick={() => onFeatureClick(feat.id)}
              onKeyDown={(e) => handleRowKeyDown(e, feat.id)}
              tabIndex={0}
              role="button"
              aria-label={`View details for ${feat.title}`}
            >
              <td className={styles.td}>
                <div className={styles.titleWrapper}>
                  <span className={styles.titleText}>{feat.title}</span>
                  {feat.is_reviewed && <VerifiedBadge size={18} className={styles.reviewedBadge} />}
                </div>
              </td>
              <td className={styles.td}>
                <StatusBadge
                  status={feat.stage_slug || feat.status}
                  name={feat.stage_name}
                  color={feat.stage_color}
                />
              </td>
              <td className={styles.td}>
                {feat.category_name ? (
                  <div className={styles.categoryWrapper}>
                    <CategoryIcon
                      name={feat.category_icon}
                      color={feat.category_color}
                      size={14}
                      className={styles.categoryIcon}
                    />
                    <span className={styles.categoryText}>{feat.category_name}</span>
                  </div>
                ) : (
                  <span className={styles.mutedText}>—</span>
                )}
              </td>
              <td className={styles.td}>
                <span className={styles.dateText}>
                  {new Date(feat.updated_at).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </td>
              <td className={styles.td} style={{ textAlign: 'center' }}>
                <GravityBadge score={feat.gravity_score || 0} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PublicTableView;
