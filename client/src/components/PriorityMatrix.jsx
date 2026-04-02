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

  // Axis dots (1-5)
  const axisIndices = [5, 4, 3, 2, 1];
  const xAxisIndices = [1, 2, 3, 4, 5];

  return (
    <div className={styles.container}>
      <div className={styles.matrixLayout}>
        {/* Y Axis (Impact) */}
        <div className={styles.yAxis}>
          <div className={styles.axisLabelVertical}>IMPACT</div>
          {axisIndices.map(i => (
            <div key={`y-${i}`} className={styles.axisMarker}>
              <div className={styles.dotGroupVertical}>
                {Array.from({ length: i }).map((_, idx) => (
                  <div key={idx} className={styles.axisDotBlue} />
                ))}
              </div>
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
                      // Map score 0-100 to size 8-28px
                      const size = 8 + (score / 100) * 20;
                      return (
                        <button
                          key={f.id}
                          onClick={() => onFeatureClick(f)}
                          className={`${styles.featureDot} ${selectedFeatureId === f.id ? styles.featureDotSelected : ''}`}
                          style={{ 
                            width: `${size}px`, 
                            height: `${size}px`,
                            backgroundColor: selectedFeatureId === f.id ? '#0c4bea' : (score >= 60 ? '#10b981' : score >= 30 ? '#f59e0b' : '#cbd5e1')
                          }}
                          title={`${f.title}\nGravity: ${score}/100\nImpact: ${f.impact}, Effort: ${f.effort}\nVotes: ${f.vote_count}`}
                        />
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
              <div className={styles.dotGroupHorizontal}>
                {Array.from({ length: i }).map((_, idx) => (
                  <div key={idx} className={styles.axisDotOrange} />
                ))}
              </div>
            </div>
          ))}
          <div className={styles.axisLabelHorizontal}>EFFORT</div>
        </div>
      </div>

      <div className={styles.legend}>
        <p className={styles.legendText}>
          <strong>Quick Wins</strong> (High Impact, Low Effort) are in the top-left section.
        </p>
      </div>
    </div>
  );
};

export default PriorityMatrix;
