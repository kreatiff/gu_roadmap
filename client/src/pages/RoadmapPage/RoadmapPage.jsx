import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import FeatureCard from '../../components/FeatureCard';
import CategoryDropdown from '../../components/CategoryDropdown';
import { getFeatures, getFeatureTags } from '../../api/features';
import { getCategories } from '../../api/categories';
import { getStages } from '../../api/stages';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../contexts/AuthContext';
import EmptyState from '../../components/EmptyState';
import FeatureDetailModal from '../../components/FeatureDetailModal';
import styles from './RoadmapPage.module.css';

const RoadmapPage = ({ initialFilters = {}, isDashboard = false, scopedMeta = null, dashboardName = '' }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, login, loading: authLoading } = useAuth();
  const featureId = searchParams.get('feature');

  const [features, setFeatures] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stages, setStages] = useState([]);
  const [allTags, setAllTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ 
    status: [], 
    category: [], 
    search: '',
    tags: []
  });
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const observer = useRef();
  
  const debouncedSearch = useDebounce(filter.search, 400);

  // Fetch metadata once on mount — skipped in dashboard mode (uses scopedMeta instead)
  useEffect(() => {
    if (isDashboard) return;
    const fetchMetadata = async () => {
      try {
        const [cData, stData, tData] = await Promise.all([
          getCategories(), 
          getStages(),
          getFeatureTags()
        ]);
        setCategories(cData);
        setStages(stData);
        setAllTags(tData);
      } catch (err) {
        console.error('Failed to fetch metadata:', err);
      }
    };
    fetchMetadata();
  }, [isDashboard]);

  const fetchFeatures = useCallback(async (pageNum, append = false) => {
    try {
      if (append) setIsFetchingMore(true);
      else setLoading(true);

      // Merge initial dashboard filters with current user filters
      const dashboardStatus = initialFilters.stage_slugs || (initialFilters.stage_slug ? [initialFilters.stage_slug] : []);
      const effectiveStatus = [...new Set([...dashboardStatus, ...filter.status])];

      const dashboardCategory = initialFilters.category_ids || (initialFilters.category_id ? [initialFilters.category_id] : []);
      const effectiveCategory = [...new Set([...dashboardCategory, ...filter.category])];

      const fRes = await getFeatures({ 
        status: effectiveStatus, 
        category: effectiveCategory, 
        search: debouncedSearch,
        requiredTags: initialFilters.tags?.length ? [...new Set(initialFilters.tags)] : undefined,
        tags: filter.tags?.length ? [...new Set(filter.tags)] : undefined,
        page: pageNum,
        limit: 12
      });
      
      const newFeatures = fRes.data || [];
      if (append) {
        setFeatures(prev => [...prev, ...newFeatures]);
      } else {
        setFeatures(newFeatures);
      }
      
      setHasMore(fRes.meta?.hasMore || false);
    } catch (err) {
      console.error('Failed to fetch features:', err);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  }, [
    filter.status, 
    filter.category, 
    filter.tags, 
    debouncedSearch,
    initialFilters.stage_slug,
    initialFilters.stage_slugs,
    initialFilters.category_id,
    initialFilters.category_ids,
    initialFilters.tags
  ]);

  // Triggered on filter changes
  useEffect(() => {
    setPage(1);
    fetchFeatures(1, false);
  }, [fetchFeatures]);

  // Observer callback for infinite scroll
  const lastFeatureElementRef = useCallback(node => {
    if (loading || isFetchingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchFeatures(nextPage, true);
      }
    }, { rootMargin: '200px' });
    
    if (node) observer.current.observe(node);
  }, [loading, isFetchingMore, hasMore, page, fetchFeatures]);

  const toggleStatus = (id) => {
    setFilter(prev => {
      if (id === '') return { ...prev, status: [] };
      const newStatus = prev.status.includes(id)
        ? prev.status.filter(s => s !== id)
        : [...prev.status, id];
      return { ...prev, status: newStatus };
    });
  };

  const toggleCategory = (id) => {
    setFilter(prev => {
      const newCategory = prev.category.includes(id)
        ? prev.category.filter(c => c !== id)
        : [...prev.category, id];
      return { ...prev, category: newCategory };
    });
  };

  const toggleTag = (tag) => {
    setFilter(prev => {
      const newTags = prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : [...prev.tags, tag];
      return { ...prev, tags: newTags };
    });
  };

  // In dashboard mode, derive status pills from the scoped meta returned by the server.
  // In normal mode, use the globally fetched stages list.
  const statuses = isDashboard
    ? [
        { id: '', label: 'All' },
        ...(scopedMeta?.stages ?? []).filter(s => s.is_visible).map(s => ({ id: s.slug, label: s.name }))
      ]
    : [
        { id: '', label: 'All Stages' },
        ...stages.filter(s => s.is_visible).map(s => ({ id: s.slug, label: s.name }))
      ];

  return (
    <div className={styles.page}>
      <Navbar />
      
      <header className={styles.header}>
        <div className={`container ${styles.headerContent}`}>
          <div className={styles.headerText}>
            <h1 className={styles.h1}>{isDashboard && dashboardName ? dashboardName : 'Public Roadmap'}</h1>
            <p className={styles.headerSubtitle}>
              {isDashboard
                ? 'A curated view of the roadmap filtered for this dashboard preset.'
                : 'Help us shape the future of Griffith University\'s digital experience. Vote for the features you need and track our progress in real-time.'}
            </p>
          </div>
        </div>
      </header>

      {isDashboard && (
        <div className={styles.dashboardBanner}>
          <div className={`container ${styles.dashboardBannerInner}`}>
            <span className={styles.dashboardBannerText}>
              Viewing a filtered dashboard preset
            </span>
            <a href="/" className={styles.dashboardBannerLink}>
              View Full Roadmap →
            </a>
          </div>
        </div>
      )}

      <main className={`container ${styles.main}`}>
        {/* Horizontal Status Filter Pills */}
        <div className={styles.statusRow}>
          {statuses.map(s => (
            <button 
              key={s.id}
              onClick={() => toggleStatus(s.id)}
              disabled={!isAuthenticated && !isDashboard}
              className={`${styles.statusPill} ${
                (s.id === '' && filter.status.length === 0) || filter.status.includes(s.id) 
                  ? styles.statusPillActive 
                  : ''
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Tag Filters (Sub-filtering) — available in dashboards or for logged-in users */}
        {(isDashboard || isAuthenticated) && (
          <div className={styles.tagRow}>
            {(isDashboard ? (scopedMeta?.tags ?? []) : allTags)
              .filter(tag => !(initialFilters.tags ?? []).includes(tag)) // Hide tags already in scope
              .filter(tag => !categories.some(c => c.name.toLowerCase() === tag.toLowerCase())) // Hide tags that match category names
              .map(tag => (
                <button
                  key={tag}
                  onClick={() => toggleTag(tag)}
                  className={`${styles.tagPill} ${filter.tags.includes(tag) ? styles.tagPillActive : ''}`}
                >
                  {tag}
                </button>
              ))}
          </div>
        )}

        {!isAuthenticated && !authLoading && !isDashboard ? (
          <div className={styles.authWall}>
             <div className={styles.authCard}>
                <h2 className={styles.authTitle}>Join the Community</h2>
                <p className={styles.authDesc}>Please log in with your Griffith credentials to view the full roadmap, participate in discussions, and vote for the future of our digital services.</p>
                <button onClick={login} className={styles.loginBtn}>Login with GU SSO</button>
             </div>
          </div>
        ) : (
          <>
            {/* Search & Category — category hidden in dashboard mode */}
            <div className={styles.filterSection}>
              <div className={styles.inputGroup}>
                <input 
                  type="text" 
                  placeholder="Search features..." 
                  value={filter.search}
                  onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                  className={styles.searchInput}
                />
              </div>
              
              {!isDashboard && (
                <div className={styles.categoryFilterSection}>
                  <h4 className={styles.filterLabel}>Filter by Category</h4>
                  <div className={styles.categoryGrid}>
                    {categories.map(cat => (
                      <label key={cat.id} className={styles.checkboxLabel}>
                        <input 
                          type="checkbox"
                          checked={filter.category.includes(cat.id)}
                          onChange={() => toggleCategory(cat.id)}
                          className={styles.checkbox}
                        />
                        <span>{cat.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {loading && features.length === 0 ? (
              <div className={styles.infoMessage}>Loading modern roadmap...</div>
            ) : features.length > 0 ? (
              <div className={`${styles.grid} ${loading ? styles.gridLoading : ''}`}>
                {features.map((f, index) => {
                  const isLast = index === features.length - 1;
                  return (
                    <div ref={isLast ? lastFeatureElementRef : null} key={f.id}>
                      <FeatureCard 
                        feature={f} 
                        onClick={() => {
                          searchParams.set('feature', f.id);
                          setSearchParams(searchParams);
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState 
                title="No roadmap items found" 
                description="There are currently no features matching these criteria. Try removing some filters or searching for something else."
              />
            )}
            
            {isFetchingMore && (
              <div className={styles.footerActions}>
                <p className={styles.showingText}>Loading more features...</p>
              </div>
            )}
            
            {!hasMore && features.length > 0 && (
              <div className={styles.footerActions}>
                <p className={styles.showingText}>You've reached the end — {features.length} requests shown.</p>
              </div>
            )}
          </>
        )}
      </main>

      {/* Global Feature Detail Modal */}
      {featureId && (
        <FeatureDetailModal 
          featureId={featureId} 
          onClose={() => {
            searchParams.delete('feature');
            setSearchParams(searchParams);
          }}
          onUpdate={() => fetchFeatures(1, false)}
        />
      )}

      <footer className={styles.footer}>
        <div className="container">
          &copy; {new Date().getFullYear()} Griffith University — Roadmap
        </div>
      </footer>
    </div>
  );
};

export default RoadmapPage;
