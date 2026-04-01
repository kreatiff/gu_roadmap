import React from 'react';

const PriorityMatrix = ({ features, onFeatureClick }) => {
  // Simple mapping for 1-5 coordinates to percentage
  // 1 -> 15%, 2 -> 32%, 3 -> 50%, 4 -> 68%, 5 -> 85%
  const getPos = (val) => {
    return ((val - 1) * 17.5 + 15);
  };

  return (
    <div style={styles.container}>
      <style>{`
        .matrix-dot:hover {
          transform: translate(-50%, 50%) scale(1.4) !important;
          z-index: 100 !important;
        }
        .matrix-dot:hover .matrix-tooltip {
          opacity: 1 !important;
          transform: translateX(-50%) translateY(0) !important;
          pointer-events: auto !important;
        }
      `}</style>

      <div style={styles.matrixWrapper}>
        {/* Quadrant Labels */}
        <div style={{ ...styles.quadrantLabel, top: '10%', left: '10%' }}>Quick Wins</div>
        <div style={{ ...styles.quadrantLabel, top: '10%', right: '10%', textAlign: 'right' }}>Major Projects</div>
        <div style={{ ...styles.quadrantLabel, bottom: '10%', left: '10%' }}>Fill-ins</div>
        <div style={{ ...styles.quadrantLabel, bottom: '10%', right: '10%', textAlign: 'right' }}>Time Sinks</div>

        {/* Axes Labels */}
        <div style={styles.yAxisLabel}>Impact</div>
        <div style={styles.xAxisLabel}>Effort</div>

        {/* The Grid Lines */}
        <div style={styles.vLine} />
        <div style={styles.hLine} />

        {/* The Points */}
        {features.map((f) => (
          <div
            key={f.id}
            onClick={() => onFeatureClick(f)}
            className="matrix-dot"
            style={{
              ...styles.dot,
              bottom: `${getPos(f.impact)}%`,
              left: `${getPos(f.effort)}%`,
              backgroundColor: f.section_color || 'var(--gu-red)',
            }}
          >
            <div className="matrix-tooltip" style={styles.tooltip}>
              <div style={styles.tooltipHeader}>
                <span style={styles.tooltipTitle}>{f.title}</span>
                <span style={styles.tooltipScore}>I:{f.impact} E:{f.effort}</span>
              </div>
              <p style={styles.tooltipDesc}>
                {f.description?.length > 80 ? f.description.substring(0, 80) + '...' : f.description}
              </p>
              <div style={styles.tooltipAction}>Click to see details</div>
            </div>
          </div>
        ))}
      </div>


      <div style={styles.legend}>
        <h4 style={styles.legendTitle}>How to read this matrix</h4>
        <p style={styles.legendText}>
          We prioritize <strong>Quick Wins</strong> (High Impact, Low Effort) to deliver value fast, 
          while carefully scheduling <strong>Major Projects</strong> for long-term growth.
        </p>
      </div>
    </div>
  );
};

const styles = {
  container: {
    width: '100%',
    padding: 'var(--space-8) 0',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-12)'
  },
  matrixWrapper: {
    position: 'relative',
    width: '100%',
    maxWidth: '800px',
    aspectRatio: '1 / 1',
    backgroundColor: '#ffffff',
    border: '2px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-md)',
    margin: 'var(--space-10) 0' // Added margin to ensure tooltips have space outside
  },


  vLine: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: '1px',
    backgroundColor: 'var(--border-color)',
    zIndex: 1
  },
  hLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    right: 0,
    height: '1px',
    backgroundColor: 'var(--border-color)',
    zIndex: 1
  },
  quadrantLabel: {
    position: 'absolute',
    fontSize: '0.75rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    color: 'rgba(0,0,0,0.15)',
    letterSpacing: '0.1em',
    pointerEvents: 'none',
    zIndex: 0,
    width: '120px'
  },
  yAxisLabel: {
    position: 'absolute',
    left: '12px',
    top: '50%',
    transform: 'translateY(-50%) rotate(-90deg)',
    fontSize: '0.625rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.2em'
  },
  xAxisLabel: {
    position: 'absolute',
    bottom: '12px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '0.625rem',
    fontWeight: '800',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.2em'
  },
  dot: {
    position: 'absolute',
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '3px solid #ffffff',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    cursor: 'pointer',
    zIndex: 10,
    transform: 'translate(-50%, 50%)',
    transition: 'all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
  },
  tooltip: {
    position: 'absolute',
    bottom: 'calc(100% + 12px)',
    left: '50%',
    transform: 'translateX(-50%) translateY(10px)',
    width: '240px',
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    backdropFilter: 'blur(8px)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-md)',
    padding: 'var(--space-4)',
    boxShadow: 'var(--shadow-lg)',
    opacity: 0,
    pointerEvents: 'none',
    transition: 'all 0.2s',
    zIndex: 100,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  tooltipHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px',
    borderBottom: '1px solid rgba(0,0,0,0.05)',
    paddingBottom: '4px',
    marginBottom: '2px'
  },
  tooltipTitle: {
    fontSize: '0.8125rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  tooltipScore: {
    fontSize: '0.625rem',
    fontWeight: '800',
    backgroundColor: 'var(--bg-base)',
    color: 'var(--text-secondary)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-pill)',
    whiteSpace: 'nowrap'
  },
  tooltipDesc: {
    fontSize: '0.75rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.4',
    margin: 0
  },
  tooltipAction: {
    fontSize: '0.625rem',
    fontWeight: '700',
    color: 'var(--gu-red)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginTop: '4px'
  },
  legend: {
    maxWidth: '600px',
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
    padding: 'var(--space-6)',
    borderRadius: 'var(--radius-md)'
  },
  legendTitle: {
    fontSize: '0.875rem',
    fontWeight: '800',
    marginBottom: 'var(--space-2)',
    color: 'var(--text-primary)'
  },
  legendText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5'
  }
};


// Add hover using JS object-based styling is hard for nested selectors without libraries, 
// so we'll rely on the parent container's hover if needed or just simple title tags for now.
// However, the tooltip opacity can be handled via CSS.
export default PriorityMatrix;
