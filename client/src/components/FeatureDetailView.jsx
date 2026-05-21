import RichTextViewer from './RichTextViewer';
import CategoryIcon from './CategoryIcon';
import VerifiedBadge from './VerifiedBadge';
import styles from './FeatureDetailView.module.css';

/**
 * FeatureDetailView renders the visual 'card' content of a feature request.
 * It is used by both FeatureDetailModal and the Admin Panel Preview.
 *
 * @param {Object} feature - The feature data object
 * @param {ReactNode} closeButton - Optional close button to render in the header
 */
const FeatureDetailView = ({ feature, closeButton = null, isAdmin = false }) => {
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
            {feature.is_reviewed && <VerifiedBadge size={34} className={styles.reviewedBadge} />}
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
            {isAdmin && feature.internal_notes && (
              <div className={styles.internalNotesSection}>
                <div className={styles.internalNotesHeader}>
                  <span className={styles.internalNotesLabel}>Internal Notes</span>
                  <span className={styles.internalNotesBadge}>Admin Only</span>
                </div>
                <RichTextViewer 
                  content={feature.internal_notes} 
                  className={styles.internalNotesContent}
                />
              </div>
            )}
            {isAdmin && feature.dependency_details && feature.dependency_details.length > 0 && (
              <div className={styles.dependenciesSection}>
                <div className={styles.dependenciesHeader}>
                  <span className={styles.dependenciesLabel}>Dependencies</span>
                  <span className={styles.dependenciesBadge}>Admin Only</span>
                </div>
                <div className={styles.dependenciesList}>
                  {feature.dependency_details.map(dep => (
                    <span key={dep.id} className={styles.dependencyChip}>{dep.title}</span>
                  ))}
                </div>
              </div>
            )}
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
