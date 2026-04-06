import { useSearchParams } from 'react-router-dom';
import { useDebounce } from './useDebounce';
import { useCallback } from 'react';

export function useRoadmapFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const getParam = (key, defaultVal) => searchParams.get(key) || defaultVal;
  
  const getArrayParam = (key) => {
    const val = searchParams.get(key);
    return val ? val.split(',').filter(Boolean) : [];
  };

  const viewMode = getParam('view', localStorage.getItem('adminViewMode') || 'board');
  const searchTerm = getParam('q', '');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const sortBy = getParam('sort', 'default');
  const sortDir = getParam('sortDir', 'desc');
  const showAllStages = getParam('allStages', 'false') === 'true';
  const groupBy = getParam('groupBy', 'category');
  
  const selectedCategoryIds = getArrayParam('categories');
  const selectedStatusIds = getArrayParam('statuses');

  const updateFilters = useCallback((updates) => {
    setSearchParams(prev => {
      const nextParams = new URLSearchParams(prev);
      
      Object.entries(updates).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) {
          nextParams.delete(key);
        } else if (Array.isArray(value)) {
          nextParams.set(key, value.join(','));
        } else {
          nextParams.set(key, value);
        }
      });
      
      if (updates.view) {
        localStorage.setItem('adminViewMode', updates.view);
      }
      
      return nextParams;
    });
  }, [setSearchParams]);

  const toggleSort = useCallback((key) => {
    setSearchParams(prev => {
      const nextParams = new URLSearchParams(prev);
      const currentSort = nextParams.get('sort') || 'default';
      const currentDir = nextParams.get('sortDir') || 'desc';
      
      if (currentSort === key) {
        nextParams.set('sortDir', currentDir === 'asc' ? 'desc' : 'asc');
      } else {
        nextParams.set('sort', key);
        nextParams.set('sortDir', 'desc');
      }
      return nextParams;
    });
  }, [setSearchParams]);

  const clearAllFilters = useCallback(() => {
    setSearchParams(prev => {
      const nextParams = new URLSearchParams(prev);
      nextParams.delete('q');
      nextParams.delete('categories');
      nextParams.delete('statuses');
      return nextParams;
    });
  }, [setSearchParams]);

  return {
    viewMode,
    searchTerm,
    debouncedSearchTerm,
    sortBy,
    sortDir,
    showAllStages,
    groupBy,
    selectedCategoryIds,
    selectedStatusIds,
    updateFilters,
    toggleSort,
    clearAllFilters
  };
}
