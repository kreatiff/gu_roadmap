import { useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import CategoryIcon from './CategoryIcon';
import styles from './CategoryDropdown.module.css';

const CategoryDropdown = ({ categories, selectedId, onSelect }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');

  const selectedCategory = categories.find(c => c.id === selectedId);

  const filteredCategories = categories.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className={styles.container}>
      <button 
        type="button" 
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedCategory ? (
          <>
            <CategoryIcon name={selectedCategory.icon} color={selectedCategory.color} size={18} />
            <span className={styles.label}>{selectedCategory.name}</span>
          </>
        ) : (
          <span className={styles.placeholder}>All Categories</span>
        )}
        <ChevronDown size={16} className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.searchWrapper}>
            <Search size={14} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search categories..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
              autoFocus
            />
            {search && (
              <button className={styles.clearBtn} onClick={() => setSearch('')}>
                <X size={14} />
              </button>
            )}
          </div>

          <div className={styles.list}>
            <button 
              className={`${styles.item} ${!selectedId ? styles.itemActive : ''}`}
              onClick={() => {
                onSelect('');
                setIsOpen(false);
              }}
            >
              All Categories
            </button>
            
            {filteredCategories.map(c => (
              <button 
                key={c.id}
                className={`${styles.item} ${selectedId === c.id ? styles.itemActive : ''}`}
                onClick={() => {
                  onSelect(c.id);
                  setIsOpen(false);
                }}
              >
                <CategoryIcon name={c.icon} color={c.color} size={18} />
                <span className={styles.itemName}>{c.name}</span>
                {c.feature_count !== undefined && (
                  <span className={styles.count}>{c.feature_count}</span>
                )}
              </button>
            ))}

            {filteredCategories.length === 0 && (
              <div className={styles.noResults}>No categories found</div>
            )}
          </div>
        </div>
      )}

      {isOpen && <div className={styles.overlay} onClick={() => setIsOpen(false)} />}
    </div>
  );
};

export default CategoryDropdown;
