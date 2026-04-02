import styles from './EmptyState.module.css';

const EmptyState = ({ 
  title = "No results found", 
  description = "Try adjusting your search or filters to find what you're looking for." 
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.iconWrapper}>
        <svg className={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
    </div>
  );
};

export default EmptyState;
