import { useMemo } from 'react';
import styles from './PriorityMatrix.module.css';

const PriorityMatrix = ({ features, onFeatureClick, selectedFeatureId }) => {
  // Group features by coordinates for clustering
  const groupedFeatures = useMemo(() => {
    const groups = {};
    features.forEach(f => {
      const key = `${f.impact}-${f.effort}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(f);
    });
    return groups;
  }, [features]);

  // Axis dots (1-10) — effort is reversed so low effort is on the right
  const axisIndices = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const xAxisIndices = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

  return (
    <div className={styles.container}>
      <div className={styles.matrixLayout}>
        {/* Y Axis (Impact) */}
        <div className={styles.yAxis}>
          <div className={styles.axisLabelVertical}>IMPACT</div>
          {axisIndices.map(i => (
            <div key={`y-${i}`} className={styles.axisMarker}>
              <span className={styles.axisNumber}>{i}</span>
            </div>
          ))}
        </div>

        {/* Matrix Content */}
        <div className={styles.matrixGrid}>
          {axisIndices.map(y => (
            xAxisIndices.map(x => {
              const cellFeatures = groupedFeatures[`${y}-${x}`] || [];
              return (
                <div key={`${y}-${x}`} className={styles.cell}>
                  <div className={styles.cluster}>
                    {cellFeatures.map(f => {
                      const score = f.gravity_score || 0;
                      const bgColor = selectedFeatureId === f.id
                        ? '#0c4bea'
                        : score >= 60 ? '#10b981' : score >= 30 ? '#f59e0b' : '#cbd5e1';
                      const textColor = selectedFeatureId === f.id || score >= 30 ? '#ffffff' : '#475569';
                      return (
                        <div
                          key={f.id}
                          onClick={() => onFeatureClick(f)}
                          className={`${styles.featureBadge} ${selectedFeatureId === f.id ? styles.featureBadgeSelected : ''}`}
                          style={{ backgroundColor: bgColor, color: textColor }}
                          title={`${f.title}\nGravity: ${score}/100\nImpact: ${f.impact}, Effort: ${f.effort}`}
                        >
                          <span className={styles.featureBadgeText}>{f.title}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          ))}
        </div>

        {/* X Axis (Effort) */}
        <div className={styles.xAxisSpacer} />
        <div className={styles.xAxis}>
          {xAxisIndices.map(i => (
            <div key={`x-${i}`} className={styles.axisMarker}>
              <span className={styles.axisNumber}>{i}</span>
            </div>
          ))}
          <div className={styles.axisLabelHorizontal}>EFFORT</div>
        </div>
      </div>

      <div className={styles.legend}>
        <p className={styles.legendText}>
          <strong>Quick Wins</strong> (High Impact, Low Effort) are in the top-right section.
        </p>
      </div>
    </div>
  );
};

export default PriorityMatrix;
