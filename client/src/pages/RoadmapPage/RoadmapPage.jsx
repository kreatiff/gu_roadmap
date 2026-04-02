import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import FeatureCard from '../../components/FeatureCard';
import CategoryDropdown from '../../components/CategoryDropdown';
import { getFeatures } from '../../api/features';
import { getCategories } from '../../api/categories';
import { getStages } from '../../api/stages';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../contexts/AuthContext';
import EmptyState from '../../components/EmptyState';
import FeatureDetailModal from '../../components/FeatureDetailModal';
import styles from './RoadmapPage.module.css';

const RoadmapPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, login, loading: authLoading } = useAuth();
  const featureId = searchParams.get('feature');

  const [features, setFeatures] = useState([]);
  const [categories, setCategories] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', category: '', search: '' });
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const observer = useRef();
  
  const debouncedSearch = useDebounce(filter.search, 400);

  // Fetch metadata once on mount
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const [cData, stData] = await Promise.all([getCategories(), getStages()]);
        setCategories(cData);
        setStages(stData);
      } catch (err) {
        console.error('Failed to fetch metadata:', err);
      }
    };
    fetchMetadata();
  }, []);

  const fetchFeatures = useCallback(async (pageNum, append = false) => {
    try {
      if (append) setIsFetchingMore(true);
      else setLoading(true);

      const fRes = await getFeatures({ 
        status: filter.status, 
        category: filter.category, 
        search: debouncedSearch,
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
  }, [filter.status, filter.category, debouncedSearch]);

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

  const statuses = [
    { id: '', label: 'All Stages' },
    ...stages.filter(s => s.is_visible === 1).map(s => ({ id: s.slug, label: s.name }))
  ];

  return (
    <div className={styles.page}>
      <Navbar />
      
      <header className={styles.header}>
        <div className={`container ${styles.headerContent}`}>
          <div className={styles.headerText}>
            <h1 className={styles.h1}>Public Roadmap</h1>
            <p className={styles.headerSubtitle}>
              Help us shape the future of Griffith University's digital experience.
              Vote for the features you need and track our progress in real-time.
            </p>
          </div>
        </div>
      </header>

      <main className={`container ${styles.main}`}>
        {/* Horizontal Status Filter Pills */}
        <div className={styles.statusRow}>
          {statuses.map(s => (
            <button 
              key={s.id}
              onClick={() => setFilter(prev => ({ ...prev, status: s.id }))}
              disabled={!isAuthenticated}
              className={`${styles.statusPill} ${filter.status === s.id ? styles.statusPillActive : ''}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {!isAuthenticated && !authLoading ? (
          <div className={styles.authWall}>
             <div className={styles.authCard}>
                <h2 className={styles.authTitle}>Join the Community</h2>
                <p className={styles.authDesc}>Please log in with your Griffith credentials to view the full roadmap, participate in discussions, and vote for the future of our digital services.</p>
                <button onClick={login} className={styles.loginBtn}>Login with GU SSO</button>
             </div>
          </div>
        ) : (
          <>
            {/* Search & Category hybrid */}
            <div className={styles.filterSection}>
              <div className={styles.inputGroup}>
                <input 
                  type="text" 
                  placeholder="Search features..." 
                  value={filter.search}
                  onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                  className={styles.searchInput}
                />
                
                <CategoryDropdown 
                  categories={categories} 
                  selectedId={filter.category} 
                  onSelect={(id) => setFilter(prev => ({ ...prev, category: id }))} 
                />
              </div>
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
