import VoteButton from './VoteButton';
import RichTextViewer from './RichTextViewer';
import CategoryIcon from './CategoryIcon';
import styles from './FeatureDetailView.module.css';

/**
 * FeatureDetailView renders the visual 'card' content of a feature request.
 * It is used by both FeatureDetailModal and the Admin Panel Preview.
 * 
 * @param {Object} feature - The feature data object
 * @param {Function} onUpdate - Optional callback for voting updates
 * @param {Boolean} showActions - Whether to show the voting buttons (defaults to true)
 * @param {ReactNode} closeButton - Optional close button to render in the header
 */
const FeatureDetailView = ({ feature, onUpdate, showActions = true, closeButton = null }) => {
  if (!feature) return null;

  return (
    <div 
      className={styles.viewCard} 
      style={{ '--modal-accent': feature.category_color || '#e8341c' }}
    >
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <div className={styles.dualBadge}>
            <div 
              className={styles.categorySide} 
              style={{ '--accent': feature.category_color }}
            >
              <CategoryIcon 
                name={feature.category_icon} 
                color={feature.category_color} 
                size={11} 
              />
              <span>{feature.category_name}</span>
            </div>
            <div 
              className={styles.statusSide}
              style={{ '--status-color': feature.stage_color || '#64748b' }}
            >
              {feature.stage_name || feature.status}
            </div>
          </div>
          
          <div className={styles.headerActions}>
            {showActions && (
              <VoteButton 
                featureId={feature.id} 
                initialCount={feature.vote_count} 
                initialVoted={feature.user_voted}
                onUpdate={onUpdate}
                isCombined={true}
              />
            )}
            {closeButton}
          </div>
        </div>

        <h1 className={styles.title}>{feature.title}</h1>
      </div>

      <div className={styles.body}>
        <div className={styles.content}>
          <div className={styles.mainInfo}>
            <RichTextViewer 
              content={feature.description || 'No detailed description available for this request.'} 
              className={styles.description}
            />
          </div>

          <div className={styles.footer}>
            <div className={styles.footerMeta}>
              {feature.tags && feature.tags.length > 0 && (
                <div className={styles.tags}>
                  {feature.tags.map((tag, i) => (
                    <span key={i} className={styles.tag}>#{tag}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FeatureDetailView;
