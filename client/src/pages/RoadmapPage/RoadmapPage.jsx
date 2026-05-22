import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid, Columns, Table } from 'lucide-react';
import Navbar from '../../components/Navbar';
import FeatureCard from '../../components/FeatureCard';
import FilterBar from '../../components/FilterBar/FilterBar';
import PublicSwimlaneView from '../../components/PublicSwimlaneView/PublicSwimlaneView';
import PublicTableView from '../../components/PublicTableView/PublicTableView';
import { getFeatures, getFeatureTags } from '../../api/features';
import { getCategories } from '../../api/categories';
import { getStages } from '../../api/stages';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../contexts/AuthContext';
import EmptyState from '../../components/EmptyState';
import FeatureDetailModal from '../../components/FeatureDetailModal';
import styles from './RoadmapPage.module.css';

const RoadmapPage = ({ initialFilters = {}, isDashboard = false, scopedMeta = null, dashboardName = '', availableViews = null, dashboardSlug = '' }) => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isAuthenticated, isAdmin, navigateToLogin, loading: authLoading } = useAuth();
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
    tags: [],
    is_reviewed: ''
  });

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const observer = useRef();

  const debouncedSearch = useDebounce(filter.search, 400);

  // View mode state
  const ALL_VIEWS = ['grid', 'swimlane', 'table'];
  const effectiveAvailableViews = availableViews ?? ALL_VIEWS;

  const [viewMode, setViewMode] = useState(() => {
    const storageKey = isDashboard && dashboardSlug ? `dashboardViewMode_${dashboardSlug}` : 'publicViewMode';
    const saved = localStorage.getItem(storageKey);
    return effectiveAvailableViews.includes(saved) ? saved : effectiveAvailableViews[0];
  });

  // Persist view mode preference
  useEffect(() => {
    const storageKey = isDashboard && dashboardSlug ? `dashboardViewMode_${dashboardSlug}` : 'publicViewMode';
    localStorage.setItem(storageKey, viewMode);
  }, [viewMode, isDashboard, dashboardSlug]);

  // When available views change (e.g. dashboard edit), reset to first available if current is no longer allowed
  useEffect(() => {
    if (!effectiveAvailableViews.includes(viewMode)) {
      setViewMode(effectiveAvailableViews[0]);
    }
  }, [effectiveAvailableViews, viewMode]);

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
      const effectiveStatus = filter.status.length > 0 ? filter.status : dashboardStatus;

      const dashboardCategory = initialFilters.category_ids || (initialFilters.category_id ? [initialFilters.category_id] : []);
      const effectiveCategory = filter.category.length > 0 ? filter.category : dashboardCategory;

      const fRes = await getFeatures({
        status: effectiveStatus,
        category: effectiveCategory,
        search: debouncedSearch,
        requiredTags: initialFilters.tags?.length ? [...new Set(initialFilters.tags)] : undefined,
        tags: filter.tags?.length ? [...new Set(filter.tags)] : undefined,
        is_reviewed: filter.is_reviewed || undefined,
        page: pageNum,
        limit: viewMode === 'grid' ? 12 : 500
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
    filter.is_reviewed,
    debouncedSearch,
    initialFilters.stage_slug,
    initialFilters.stage_slugs,
    initialFilters.category_id,
    initialFilters.category_ids,
    initialFilters.tags,
    viewMode
  ]);

  // Triggered on filter changes
  useEffect(() => {
    setPage(1);
    fetchFeatures(1, false);
  }, [fetchFeatures]);

  // Observer callback for infinite scroll (grid mode only)
  const lastFeatureElementRef = useCallback(node => {
    if (viewMode !== 'grid') return;
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
  }, [loading, isFetchingMore, hasMore, page, fetchFeatures, viewMode]);



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
                : 'Help us shape the future of Griffith University\'s digital experience. Track our progress in real-time.'}
            </p>
          </div>
        </div>
      </header>

      <main className={`container ${styles.main}`}>
        {!isAuthenticated && !authLoading && !isDashboard ? (
          <div className={styles.authWall}>
            <div className={styles.authCard}>
              <h2 className={styles.authTitle}>Join the Community</h2>
              <p className={styles.authDesc}>Please log in with your Griffith credentials to view the full roadmap, participate in discussions, and help shape the future of our digital services.</p>
              <button onClick={navigateToLogin} className={styles.loginBtn}>Login with GU SSO</button>
            </div>
          </div>
        ) : (
          <>
            <FilterBar
              filter={filter}
              setFilter={setFilter}
              categories={categories}
              stages={isDashboard ? (scopedMeta?.stages ?? []) : stages}
              allTags={isDashboard ? (scopedMeta?.tags ?? []) : allTags}
              isDashboard={isDashboard}
              isAuthenticated={isAuthenticated}
              initialFilters={initialFilters}
            />

            {/* View Mode Toggle */}
            {effectiveAvailableViews.length > 1 && (
              <div className={styles.viewSwitcher}>
                {effectiveAvailableViews.includes('grid') && (
                  <button
                    className={viewMode === 'grid' ? styles.viewBtnActive : styles.viewBtn}
                    onClick={() => setViewMode('grid')}
                    aria-pressed={viewMode === 'grid'}
                    type="button"
                  >
                    <LayoutGrid size={16} /> Grid
                  </button>
                )}
                {effectiveAvailableViews.includes('swimlane') && (
                  <button
                    className={viewMode === 'swimlane' ? styles.viewBtnActive : styles.viewBtn}
                    onClick={() => setViewMode('swimlane')}
                    aria-pressed={viewMode === 'swimlane'}
                    type="button"
                  >
                    <Columns size={16} /> Swimlane
                  </button>
                )}
                {effectiveAvailableViews.includes('table') && (
                  <button
                    className={viewMode === 'table' ? styles.viewBtnActive : styles.viewBtn}
                    onClick={() => setViewMode('table')}
                    aria-pressed={viewMode === 'table'}
                    type="button"
                  >
                    <Table size={16} /> Table
                  </button>
                )}
              </div>
            )}

            {loading && features.length === 0 ? (
              <div className={styles.infoMessage}>Loading modern roadmap...</div>
            ) : features.length === 0 ? (
              <EmptyState
                title="No roadmap items found"
                description="There are currently no features matching these criteria. Try removing some filters or searching for something else."
              />
            ) : viewMode === 'grid' ? (
              <>
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
            ) : viewMode === 'swimlane' ? (
              <PublicSwimlaneView
                features={features}
                stages={isDashboard ? (scopedMeta?.stages ?? []) : stages}
                onFeatureClick={(id) => {
                  searchParams.set('feature', id);
                  setSearchParams(searchParams);
                }}
              />
            ) : (
              <PublicTableView
                features={features}
                onFeatureClick={(id) => {
                  searchParams.set('feature', id);
                  setSearchParams(searchParams);
                }}
              />
            )}
          </>
        )}
      </main>

      {/* Global Feature Detail Modal */}
      {featureId && (
        <FeatureDetailModal
          featureId={featureId}
          isAdmin={isAdmin}
          onClose={() => {
            searchParams.delete('feature');
            setSearchParams(searchParams);
          }}
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
