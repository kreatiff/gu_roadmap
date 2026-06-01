import { Search } from 'lucide-react';
import styles from './EmptyState.module.css';

const EmptyState = ({ 
  title = "No results found", 
  description = "Try adjusting your search or filters to find what you're looking for." 
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.iconWrapper}>
        <Search size={48} strokeWidth={1.5} className={styles.icon} />
      </div>
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
    </div>
  );
};

export default EmptyState;
