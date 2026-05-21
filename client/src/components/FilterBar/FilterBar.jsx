import { useState } from 'react';
import { Search, X, Filter } from 'lucide-react';
import VerifiedBadge from '../VerifiedBadge';
import FilterDropdown from '../FilterDropdown/FilterDropdown';
import MultiSelectFilter from '../MultiSelectFilter/MultiSelectFilter';
import styles from './FilterBar.module.css';

const FilterBar = ({ 
  filter, 
  setFilter, 
  categories = [], 
  stages = [], 
  allTags = [], 
  isDashboard = false, 
  isAuthenticated = false,
  initialFilters = {} 
}) => {
  const [tagSearch, setTagSearch] = useState('');

  // 1. Handlers
  const handleSearchChange = (e) => {
    setFilter(prev => ({ ...prev, search: e.target.value }));
  };

  const clearSearch = () => {
    setFilter(prev => ({ ...prev, search: '' }));
  };

  const handleStatusChange = (newStatuses) => {
    setFilter(prev => ({ ...prev, status: newStatuses }));
  };

  const handleCategoryChange = (newCategories) => {
    setFilter(prev => ({ ...prev, category: newCategories }));
  };

  const handleTagChange = (tag, isChecked) => {
    setFilter(prev => {
      const nextTags = isChecked 
        ? [...prev.tags, tag]
        : prev.tags.filter(t => t !== tag);
      return { ...prev, tags: nextTags };
    });
  };

  const handleReviewedChange = (value) => {
    setFilter(prev => ({ ...prev, is_reviewed: value }));
  };

  const removeFilterItem = (type, value) => {
    setFilter(prev => {
      if (type === 'status') {
        return { ...prev, status: prev.status.filter(s => s !== value) };
      }
      if (type === 'category') {
        return { ...prev, category: prev.category.filter(c => c !== value) };
      }
      if (type === 'tag') {
        return { ...prev, tags: prev.tags.filter(t => t !== value) };
      }
      if (type === 'is_reviewed') {
        return { ...prev, is_reviewed: '' };
      }
      return prev;
    });
  };

  const clearAllFilters = () => {
    setFilter({
      status: [],
      category: [],
      search: '',
      tags: [],
      is_reviewed: ''
    });
  };

  // 2. Data Mappings & Scoping
  // Map statuses
  const statusOptions = stages
    .filter(s => s.is_visible)
    .map(s => ({ id: s.slug, label: s.name }));

  // Map categories
  const categoryOptions = categories.map(c => ({ id: c.id, label: c.name }));

  // Map and scope tags
  const tagsScope = isDashboard 
    ? (allTags ?? []) 
    : allTags;

  const visibleTags = tagsScope
    .filter(tag => !(initialFilters.tags ?? []).includes(tag)) // Hide tags already in dashboard preset
    .filter(tag => !categories.some(c => c.name.toLowerCase() === tag.toLowerCase())); // Hide tags matching category names

  const filteredTags = visibleTags.filter(tag => 
    tag.toLowerCase().includes(tagSearch.toLowerCase())
  );



  const activeCategoryLabels = filter.category.map(id => {
    const cat = categories.find(c => c.id === id);
    return { id, label: cat ? cat.name : id };
  });

  const hasActiveFilters = 
    filter.category.length > 0 || 
    filter.tags.length > 0 || 
    filter.search !== '' ||
    filter.is_reviewed !== '';

  return (
    <div className={styles.container}>
      {/* Stages Tabs Row */}
      <div className={styles.tabsContainer}>
        <button
          className={`${styles.tabBtn} ${filter.status.length === 0 ? styles.tabBtnActive : ''}`}
          onClick={() => handleStatusChange([])}
          type="button"
        >
          All Stages
        </button>
        {statusOptions.map(option => {
          const isActive = filter.status.includes(option.id);
          return (
            <button
              key={option.id}
              className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ''}`}
              onClick={() => handleStatusChange([option.id])}
              type="button"
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <div className={styles.reviewedTabs}>
        <button
          className={`${styles.tabBtn} ${filter.is_reviewed === '' ? styles.reviewedTabActive : ''}`}
          onClick={() => handleReviewedChange('')}
          type="button"
        >
          All
        </button>
        <button
          className={`${styles.tabBtn} ${filter.is_reviewed === 'true' ? styles.reviewedTabActive : ''}`}
          onClick={() => handleReviewedChange('true')}
          type="button"
        >
          <VerifiedBadge size={20} />
          Reviewed
        </button>
        <button
          className={`${styles.tabBtn} ${filter.is_reviewed === 'false' ? styles.reviewedTabActive : ''}`}
          onClick={() => handleReviewedChange('false')}
          type="button"
        >
          Not Reviewed
        </button>
      </div>

      <div className={styles.filterBarRow}>
        {/* Search Field */}
        <div className={styles.searchWrapper}>
          <Search size={16} className={styles.searchIcon} />
          <input 
            type="text" 
            placeholder="Search features..." 
            value={filter.search}
            onChange={handleSearchChange}
            className={styles.searchInput}
          />
          {filter.search && (
            <button className={styles.searchClearBtn} onClick={clearSearch} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </div>

        {/* Dropdowns */}
        <div className={styles.dropdownsGroup}>


          {/* Category Dropdown (only visible when not in dashboard preset) */}
          {!isDashboard && (
            <FilterDropdown 
              label="Categories" 
              selectedCount={filter.category.length}
              type="category"
            >
              <div className={styles.dropdownContent}>
                <MultiSelectFilter 
                  options={categoryOptions}
                  selectedValues={filter.category}
                  onChange={handleCategoryChange}
                />
              </div>
            </FilterDropdown>
          )}

          {/* Tags Dropdown (authenticated users in normal mode OR dashboard preset) */}
          {(isDashboard || isAuthenticated) && visibleTags.length > 0 && (
            <FilterDropdown 
              label="Tags" 
              selectedCount={filter.tags.length}
              type="tag"
            >
              <div className={`${styles.dropdownContent} ${styles.tagDropdown}`}>
                {/* Search tags inside dropdown if more than 5 */}
                {visibleTags.length > 5 && (
                  <div className={styles.tagSearchWrapper}>
                    <input 
                      type="text" 
                      placeholder="Search tags..." 
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      className={styles.tagSearchInput}
                    />
                  </div>
                )}
                
                <div className={styles.tagList}>
                  {filteredTags.map(tag => {
                    const isChecked = filter.tags.includes(tag);
                    return (
                      <label key={tag} className={styles.tagCheckboxLabel}>
                        <input 
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => handleTagChange(tag, e.target.checked)}
                          className={styles.checkbox}
                        />
                        <span className={styles.tagText}>{tag}</span>
                      </label>
                    );
                  })}
                  {filteredTags.length === 0 && (
                    <div className={styles.noTagsFound}>No tags match search</div>
                  )}
                </div>
              </div>
            </FilterDropdown>
          )}
        </div>
      </div>

      {/* Active Filter Pills Row */}
      {hasActiveFilters && (
        <div className={styles.activePillsRow}>
          <span className={styles.activeLabel}>
            <Filter size={12} /> Active:
          </span>
          
          <div className={styles.pillsList}>
            {/* Search query pill */}
            {filter.search && (
              <span className={styles.pill}>
                Search: "{filter.search}"
                <button className={styles.pillRemoveBtn} onClick={clearSearch} aria-label="Remove search filter">
                  <X size={12} />
                </button>
              </span>
            )}



            {/* Category pills */}
            {activeCategoryLabels.map(item => (
              <span key={item.id} className={`${styles.pill} ${styles.pillCategory}`}>
                Category: {item.label}
                <button 
                  className={styles.pillRemoveBtn} 
                  onClick={() => removeFilterItem('category', item.id)}
                  aria-label={`Remove category filter for ${item.label}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {/* Tag pills */}
            {filter.tags.map(tag => (
              <span key={tag} className={`${styles.pill} ${styles.pillTag}`}>
                Tag: {tag}
                <button 
                  className={styles.pillRemoveBtn} 
                  onClick={() => removeFilterItem('tag', tag)}
                  aria-label={`Remove tag filter for ${tag}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {/* Reviewed pill */}
            {filter.is_reviewed !== '' && (
              <span className={`${styles.pill} ${styles.pillVerified}`}>
                {filter.is_reviewed === 'true' ? 'Reviewed' : 'Not Reviewed'}
                <button 
                  className={styles.pillRemoveBtn} 
                  onClick={() => removeFilterItem('is_reviewed', '')}
                  aria-label="Remove reviewed filter"
                >
                  <X size={12} />
                </button>
              </span>
            )}

            {/* Clear All Button */}
            <button className={styles.clearAllBtn} onClick={clearAllFilters}>
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default FilterBar;
