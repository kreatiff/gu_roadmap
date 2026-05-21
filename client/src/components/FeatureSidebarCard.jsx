import { getPlainTextFromRichText } from './RichTextViewer';
import styles from './FeatureSidebarCard.module.css';

const FeatureSidebarCard = ({ feature, isSelected, onClick }) => {
  return (
    <div
      className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
      onClick={onClick}
      style={{ '--category-color': feature.category_color }}
    >
      <div className={styles.header}>
        <span className={styles.category}>
          {feature.category_name || 'General'}
        </span>
        <div className={styles.scores}>
          <span className={styles.score}>Impact: {feature.impact}</span>
          <span className={styles.divider}>•</span>
          <span className={styles.score}>Effort: {feature.effort}</span>
        </div>
      </div>

      <div className={styles.body}>
        <h4 className={styles.title}>{feature.title}</h4>
        <p className={styles.description}>
          {getPlainTextFromRichText(feature.description) || 'No description provided.'}
        </p>
      </div>
    </div>
  );
};

export default FeatureSidebarCard;
