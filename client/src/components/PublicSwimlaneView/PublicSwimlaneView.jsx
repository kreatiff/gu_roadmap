import { useMemo } from 'react';
import { getPlainTextFromRichText } from '../RichTextViewer';
import VerifiedBadge from '../VerifiedBadge';
import EmptyState from '../EmptyState';
import styles from './PublicSwimlaneView.module.css';

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

const PublicSwimlaneView = ({ features, stages, onFeatureClick }) => {
  const visibleStages = useMemo(() => {
    return stages.filter(s => s.is_visible !== false);
  }, [stages]);

  const columnsData = useMemo(() => {
    const map = {};
    visibleStages.forEach(s => {
      map[s.id] = features.filter(f =>
        f.stage_id === s.id || (f.stage_id === null && f.stage_slug === s.slug)
      );
    });
    return map;
  }, [features, visibleStages]);

  if (features.length === 0) {
    return (
      <EmptyState
        title="No roadmap items found"
        description="There are currently no features matching these criteria. Try removing some filters or searching for something else."
      />
    );
  }

  return (
    <div className={styles.swimlaneContainer}>
      <div className={styles.board}>
        {visibleStages.map(col => {
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
              </header>

              <div className={styles.columnCards}>
                {columnFeatures.length === 0 && (
                  <div className={styles.emptyColumn}>0 items</div>
                )}
                {columnFeatures.map(feat => (
                  <button
                    key={feat.id}
                    className={styles.card}
                    onClick={() => onFeatureClick(feat.id)}
                    type="button"
                    style={{ '--category-color': feat.category_color || '#64748b' }}
                  >
                    <div className={styles.cardBody}>
                      <div className={styles.cardHeader}>
                        <span
                          className={styles.cardTag}
                          style={{
                            color: feat.category_color || '#64748b',
                            backgroundColor: feat.category_color ? `${feat.category_color}18` : '#f1f5f9'
                          }}
                        >
                          {feat.category_name || 'GENERAL'}
                        </span>
                        <div className={styles.cardHeaderRight}>
                          {feat.is_reviewed && <VerifiedBadge size={18} className={styles.reviewedBadge} />}
                        </div>
                      </div>
                      <h4 className={styles.cardTitle}>{feat.title}</h4>
                      <div className={styles.cardFooter}>
                        <span className={styles.cardUpdatedDate}>
                          {new Date(feat.updated_at).toLocaleDateString('en-AU', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                        <GravityBadge score={feat.gravity_score || 0} />
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PublicSwimlaneView;
