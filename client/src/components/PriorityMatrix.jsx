import { useMemo, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import styles from './PriorityMatrix.module.css';

const PriorityMatrix = ({ features, onFeatureClick, onFeatureMove, selectedFeatureId }) => {
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

  // Axis numbers (1-10) — effort is reversed so low effort is on the right
  const axisIndices = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
  const xAxisIndices = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

  const handleDragEnd = useCallback((result) => {
    if (!result.destination) return;

    const { draggableId, destination } = result;
    // destination.droppableId format: "cell-{impact}-{effort}"
    const [, newImpact, newEffort] = destination.droppableId.split('-').map(Number);

    const feature = features.find(f => f.id === draggableId);
    if (!feature) return;

    // Only trigger if position actually changed
    if (feature.impact === newImpact && feature.effort === newEffort) return;

    onFeatureMove?.(draggableId, newImpact, newEffort);
  }, [features, onFeatureMove]);

  const renderFeatureBadge = (f, provided, snapshot) => {
    const score = f.gravity_score || 0;
    const isSelected = selectedFeatureId === f.id;
    const bgColor = isSelected
      ? '#0c4bea'
      : score >= 75 ? '#1a5f3f'
      : score >= 50 ? '#9ca32b'
      : score >= 25 ? '#b3541e'
      : '#475569';
    const textColor = isSelected || score >= 25 ? '#ffffff' : '#e2e8f0';

    const priorityConfig = {
      Critical: { color: '#dc2626', icon: 'double-up' },
      High:     { color: '#ea580c', icon: 'up' },
      Medium:   { color: '#9ca3af', icon: 'dash' },
      Low:      { color: '#6b7280', icon: 'down' },
    };
    const { color: priorityColor, icon: priorityIcon } = priorityConfig[f.priority] || priorityConfig.Low;

    const renderPriorityIcon = () => {
      if (priorityIcon === 'double-up') {
        return (
          <svg className={styles.priorityChevron} viewBox="0 0 24 24" fill="none" stroke={priorityColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
            <polyline points="18 21 12 15 6 21" />
          </svg>
        );
      }
      if (priorityIcon === 'up') {
        return (
          <svg className={styles.priorityChevron} viewBox="0 0 24 24" fill="none" stroke={priorityColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="18 15 12 9 6 15" />
          </svg>
        );
      }
      if (priorityIcon === 'dash') {
        return (
          <svg className={styles.priorityChevron} viewBox="0 0 24 24" fill="none" stroke={priorityColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
        );
      }
      // down
      return (
        <svg className={styles.priorityChevron} viewBox="0 0 24 24" fill="none" stroke={priorityColor} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      );
    };

    return (
      <div
        ref={provided.innerRef}
        {...provided.draggableProps}
        {...provided.dragHandleProps}
        onClick={() => onFeatureClick?.(f)}
        className={`${styles.featureBadge} ${isSelected ? styles.featureBadgeSelected : ''} ${snapshot.isDragging ? styles.featureBadgeDragging : ''}`}
        style={{
          backgroundColor: bgColor,
          color: textColor,
          ...provided.draggableProps.style,
        }}
        title={`${f.title}\nGravity: ${score}/100\nImpact: ${f.impact}, Effort: ${f.effort}`}
      >
        {renderPriorityIcon()}
        <span className={styles.featureBadgeText}>{f.title}</span>
        <span className={styles.gravityScore}>{score}</span>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <DragDropContext onDragEnd={handleDragEnd}>
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
                const droppableId = `cell-${y}-${x}`;
                return (
                  <Droppable key={droppableId} droppableId={droppableId}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`${styles.cell} ${snapshot.isDraggingOver ? styles.cellDraggingOver : ''}`}
                      >
                        <div className={styles.cluster}>
                          {cellFeatures.map((f, index) => (
                            <Draggable key={f.id} draggableId={f.id} index={index}>
                              {(dragProvided, dragSnapshot) =>
                                renderFeatureBadge(f, dragProvided, dragSnapshot)
                              }
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      </div>
                    )}
                  </Droppable>
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
      </DragDropContext>

      <div className={styles.legend}>
        <p className={styles.legendText}>
          <strong>Quick Wins</strong> (High Impact, Low Effort) are in the top-right section.
        </p>
      </div>
    </div>
  );
};

export default PriorityMatrix;
