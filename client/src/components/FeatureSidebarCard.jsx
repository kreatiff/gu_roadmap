import React from 'react';
import styles from './FeatureSidebarCard.module.css';

const FeatureSidebarCard = ({ feature, isSelected, onClick }) => {
  return (
    <div 
      className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
      onClick={onClick}
    >
      <div className={styles.category}>
        <span 
          className={styles.dot} 
          style={{ backgroundColor: feature.category_color }} 
        />
        {feature.category_name || 'General'}
      </div>
      <h4 className={styles.title}>{feature.title}</h4>
      <div className={styles.meta}>
        <span className={styles.score}>Impact: {feature.impact}</span>
        <span className={styles.divider}>•</span>
        <span className={styles.score}>Effort: {feature.effort}</span>
      </div>
    </div>
  );
};

export default FeatureSidebarCard;
