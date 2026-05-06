import React from 'react';
import styles from './MultiSelectFilter.module.css';

const MultiSelectFilter = ({ options, selectedValues = [], onChange }) => {
  const handleToggle = (value) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter(v => v !== value)
      : [...selectedValues, value];
    onChange(newValues);
  };

  if (!options || options.length === 0) return null;

  return (
    <div className={styles.container}>
      <div className={styles.grid}>
        {options.map(opt => (
          <label key={opt.id} className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={selectedValues.includes(opt.id)}
              onChange={() => handleToggle(opt.id)}
              className={styles.checkbox}
            />
            <span className={styles.labelText}>{opt.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
};

export default MultiSelectFilter;
