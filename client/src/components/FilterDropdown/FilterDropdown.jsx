import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import styles from './FilterDropdown.module.css';

const FilterDropdown = ({ label, selectedCount = 0, type, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className={styles.container}>
      <button 
        type="button" 
        className={`${styles.trigger} ${selectedCount > 0 ? styles.triggerActive : ''} ${selectedCount > 0 && type ? styles[`triggerActive_${type}`] : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={styles.triggerContent}>
          <span className={styles.label}>{label}</span>
          {selectedCount > 0 && <span className={styles.badge}>{selectedCount}</span>}
        </span>
        <ChevronDown size={14} className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.content}>
            {children}
          </div>
        </div>
      )}

      {isOpen && <div className={styles.overlay} onClick={() => setIsOpen(false)} />}
    </div>
  );
};

export default FilterDropdown;
