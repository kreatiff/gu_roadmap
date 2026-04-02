import React from 'react';
import styles from './PriorityMatrix.module.css';

const PriorityMatrix = ({ features, onFeatureClick }) => {
  // Simple mapping for 1-5 coordinates to percentage
  // 1 -> 15%, 2 -> 32%, 3 -> 50%, 4 -> 68%, 5 -> 85%
  const getPos = (val) => {
    return ((val - 1) * 17.5 + 15);
  };

  return (
    <div className={styles.container}>
      <div className={styles.matrixWrapper}>
        {/* Quadrant Labels */}
        <div className={styles.quadrantLabel} style={{ top: '10%', left: '10%' }}>Quick Wins</div>
        <div className={styles.quadrantLabel} style={{ top: '10%', right: '10%', textAlign: 'right' }}>Major Projects</div>
        <div className={styles.quadrantLabel} style={{ bottom: '10%', left: '10%' }}>Fill-ins</div>
        <div className={styles.quadrantLabel} style={{ bottom: '10%', right: '10%', textAlign: 'right' }}>Time Sinks</div>

        {/* Axes Labels */}
        <div className={styles.yAxisLabel}>Impact</div>
        <div className={styles.xAxisLabel}>Effort</div>

        {/* The Grid Lines */}
        <div className={styles.vLine} />
        <div className={styles.hLine} />

        {/* The Points */}
        {features.map((f) => (
          <div
            key={f.id}
            onClick={() => onFeatureClick(f)}
            className={styles.dot}
            style={{
              bottom: `${getPos(f.impact)}%`,
              left: `${getPos(f.effort)}%`,
              backgroundColor: f.section_color || 'var(--gu-red)',
            }}
          >
            <div className={styles.tooltip}>
              <div className={styles.tooltipHeader}>
                <span className={styles.tooltipTitle}>{f.title}</span>
                <span className={styles.tooltipScore}>I:{f.impact} E:{f.effort}</span>
              </div>
              <p className={styles.tooltipDesc}>
                {f.description?.length > 80 ? f.description.substring(0, 80) + '...' : f.description}
              </p>
              <div className={styles.tooltipAction}>Click to see details</div>
            </div>
          </div>
        ))}
      </div>


      <div className={styles.legend}>
        <h4 className={styles.legendTitle}>How to read this matrix</h4>
        <p className={styles.legendText}>
          We prioritize <strong>Quick Wins</strong> (High Impact, Low Effort) to deliver value fast, 
          while carefully scheduling <strong>Major Projects</strong> for long-term growth.
        </p>
      </div>
    </div>
  );
};

export default PriorityMatrix;
