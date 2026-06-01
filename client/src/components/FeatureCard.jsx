import { Link } from 'react-router-dom';
import VerifiedBadge from './VerifiedBadge';
import StatusBadge from './StatusBadge';
import CategoryIcon from './CategoryIcon';
import { getPlainTextFromRichText } from './RichTextViewer';
import styles from './FeatureCard.module.css';

const FeatureCard = ({ feature, onClick }) => {
  const { status, stage_slug, stage_name, stage_color, category_color, category_icon } = feature;

  return (
    <div 
      className={styles.card} 
      onClick={onClick}
      style={{ '--category-color': category_color }}
    >
      <div className={styles.header}>
        <div className={styles.badgeContainer}>
            <StatusBadge 
              status={stage_slug || status} 
              name={stage_name} 
              color={stage_color} 
            />
        </div>
        <div className={styles.headerRight}>
          {(feature.gravity_score > 0) && (
            <div className={styles.gravityIndicator}>
              <span className={styles.gravityIcon}>⚡</span>
              <span>{feature.gravity_score}</span>
            </div>
          )}
        </div>
      </div>

      {feature.is_reviewed && (
        <div className={styles.reviewedBadge}>
          <VerifiedBadge size={26} />
        </div>
      )}

      <div className={styles.body}>
        <h2 className={styles.title}>{feature.title}</h2>
        <p className={styles.description}>
          {getPlainTextFromRichText(feature.description) || 'No description provided for this roadmap feature.'}
        </p>
      </div>

      <div className={styles.footer}>
        <div className={styles.categoryInfo}>
           {feature.category_name && (
             <span className={styles.categoryValue}>
               <CategoryIcon 
                 name={category_icon} 
                 color={category_color} 
                 size={14} 
                 className={styles.categoryIcon} 
               />
               {feature.category_name}
             </span>
           )}
        </div>
        <div className={styles.meta}>
           <span className={styles.commentCount}>Click to view details</span>
        </div>
      </div>
    </div>
  );
};

export default FeatureCard;
