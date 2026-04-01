import { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Navbar from '../../components/Navbar';
import FeatureCard from '../../components/FeatureCard';
import { getFeatures } from '../../api/features';
import { getSections } from '../../api/sections';
import { getStages } from '../../api/stages';
import { useDebounce } from '../../hooks/useDebounce';
import { useAuth } from '../../contexts/AuthContext';
import EmptyState from '../../components/EmptyState';
import FeatureDetailModal from '../../components/FeatureDetailModal';
import PriorityMatrix from '../../components/PriorityMatrix';

const RoadmapPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAuthenticated, login, loading: authLoading } = useAuth();
  const featureId = searchParams.get('feature');

  const [features, setFeatures] = useState([]);
  const [sections, setSections] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', section: '', search: '' });
  const [viewMode, setViewMode] = useState('grid');
  
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const observer = useRef();
  
  const debouncedSearch = useDebounce(filter.search, 400);

  const fetchData = async (pageNum, append = false) => {
    try {
      if (append) setIsFetchingMore(true);
      else setLoading(true);

       const [fRes, sData, stData] = await Promise.all([
        getFeatures({ 
          status: filter.status, 
          section: filter.section, 
          search: debouncedSearch,
          page: pageNum,
          limit: 12
        }),
        append ? Promise.resolve(sections) : getSections(),
        append ? Promise.resolve(stages) : getStages()
      ]);
      
      const newFeatures = fRes.data || [];
      if (append) {
        setFeatures(prev => [...prev, ...newFeatures]);
      } else {
        setFeatures(newFeatures);
        setSections(sData);
        setStages(stData);
      }
      
      setHasMore(fRes.meta?.hasMore || false);
    } finally {
      setLoading(false);
      setIsFetchingMore(false);
    }
  };

  // Triggered on filter changes
  useEffect(() => {
    setPage(1);
    fetchData(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter.status, filter.section, debouncedSearch]);

  // Observer callback for infinite scroll
  const lastFeatureElementRef = useCallback(node => {
    if (loading || isFetchingMore) return;
    if (observer.current) observer.current.disconnect();
    
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchData(nextPage, true);
      }
    }, { rootMargin: '200px' });
    
    if (node) observer.current.observe(node);
  }, [loading, isFetchingMore, hasMore, page]);

  const statuses = [
    { id: '', label: 'All Projects' },
    ...stages.map(s => ({ id: s.slug, label: s.name }))
  ];

  return (
    <div style={styles.page}>
      <Navbar />
      
      <header style={styles.header}>
        <div className="container" style={styles.headerContent}>
          <div style={styles.headerText}>
            <h1 style={styles.h1}>Public Roadmap</h1>
            <p style={styles.headerSubtitle}>
              Help us shape the future of Griffith University's digital experience.
              Vote for the features you need and track our progress in real-time.
            </p>
          </div>
        </div>
      </header>

      <main className="container" style={styles.main}>
        {/* Horizontal Status Filter Pills */}
        <div style={styles.statusRow}>
          {statuses.map(s => (
            <button 
              key={s.id}
              onClick={() => setFilter(prev => ({ ...prev, status: s.id }))}
              disabled={!isAuthenticated}
              style={{
                ...styles.statusPill,
                backgroundColor: filter.status === s.id ? 'var(--gu-red)' : 'var(--bg-surface)',
                color: filter.status === s.id ? '#ffffff' : 'var(--text-secondary)',
                borderColor: filter.status === s.id ? 'var(--gu-red)' : 'var(--border-color)',
                opacity: isAuthenticated ? 1 : 0.6,
                cursor: isAuthenticated ? 'pointer' : 'default'
              }}
            >
              {s.label}
            </button>
          ))}
        </div>

        {!isAuthenticated && !authLoading ? (
          <div style={styles.authWall}>
             <div style={styles.authCard}>
                <h2 style={styles.authTitle}>Join the Community</h2>
                <p style={styles.authDesc}>Please log in with your Griffith credentials to view the full roadmap, participate in discussions, and vote for the future of our digital services.</p>
                <button onClick={login} style={styles.loginBtn}>Login with GU SSO</button>
             </div>
          </div>
        ) : (
          <>
            {/* Search & Section hybrid */}
            <div style={styles.filterSection}>
              <div style={styles.inputGroup}>
                <input 
                  type="text" 
                  placeholder="Search features..." 
                  value={filter.search}
                  onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
                  style={styles.searchInput}
                />
                
                <div style={styles.dropdownWrapper}>
                  <select 
                    value={filter.section}
                    onChange={(e) => setFilter(prev => ({ ...prev, section: e.target.value }))}
                    style={styles.sectionSelect}
                  >
                    <option value="">All Categories</option>
                    {sections.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <div style={styles.dropdownArrow}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9l6 6 6-6"/>
                    </svg>
                  </div>
                </div>

                <div style={styles.viewSwitcher}>
                  <button 
                    onClick={() => setViewMode('grid')}
                    style={{ ...styles.viewBtn, ...(viewMode === 'grid' ? styles.viewBtnActive : {}) }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>
                    Grid
                  </button>
                  <button 
                    onClick={() => setViewMode('matrix')}
                    style={{ ...styles.viewBtn, ...(viewMode === 'matrix' ? styles.viewBtnActive : {}) }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18"></path><path d="M7 12h10"></path><path d="M12 7v10"></path></svg>
                    Priority Matrix
                  </button>
                </div>
              </div>
            </div>

            {/* Feature Grid or Matrix */}
            {loading && page === 1 ? (
              <div style={styles.infoMessage}>Loading modern roadmap...</div>
            ) : features.length > 0 ? (
              viewMode === 'grid' ? (
                <div style={styles.grid}>
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
                <PriorityMatrix 
                  features={features.filter(f => f.impact && f.effort)} 
                  onFeatureClick={(f) => {
                    searchParams.set('feature', f.id);
                    setSearchParams(searchParams);
                  }}
                />
              )
            ) : (
              <EmptyState 
                title="No roadmap items found" 
                description="There are currently no features matching these criteria. Try removing some filters or searching for something else."
              />
            )}
            
            {isFetchingMore && (
              <div style={styles.footerActions}>
                <p style={styles.showingText}>Loading more features...</p>
              </div>
            )}
            
            {!hasMore && features.length > 0 && (
              <div style={styles.footerActions}>
                <p style={styles.showingText}>You've reached the end — {features.length} requests shown.</p>
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
          onUpdate={() => fetchData(1, false)}
        />
      )}

      <footer style={styles.footer}>
        <div className="container">
          &copy; {new Date().getFullYear()} Griffith University — Roadmap
        </div>
      </footer>
    </div>
  );
};

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg-base)'
  },
  header: {
    padding: 'var(--space-12) 0 var(--space-8)',
    backgroundColor: 'var(--bg-surface)'
  },
  headerContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  headerText: {
    maxWidth: '650px'
  },
  h1: {
    marginBottom: 'var(--space-4)'
  },
  headerSubtitle: {
    fontSize: '1.125rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5'
  },
  headerActions: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    gap: 'var(--space-4)'
  },
  contributorText: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    fontWeight: '500'
  },
  main: {
    flex: 1,
    paddingBottom: 'var(--space-16)'
  },
  statusRow: {
    display: 'flex',
    gap: 'var(--space-2)',
    marginBottom: 'var(--space-8)',
    marginTop: 'var(--space-8)',
    overflowX: 'auto',
    paddingBottom: '2px'
  },
  statusPill: {
    padding: '6px 16px',
    borderRadius: 'var(--radius-pill)',
    fontSize: '0.875rem',
    fontWeight: '600',
    border: '1px solid var(--border-color)',
    whiteSpace: 'nowrap'
  },
  filterSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
    marginBottom: 'var(--space-10)'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'row',
    gap: 'var(--space-4)',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  searchInput: {
    padding: '12px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
    fontSize: '0.9375rem',
    width: '100%',
    maxWidth: '360px',
    backgroundColor: '#ffffff',
    outline: 'none',
    transition: 'border-color 0.2s',
    ':focus': {
      borderColor: 'var(--gu-red)'
    }
  },
  dropdownWrapper: {
    position: 'relative',
    width: '100%',
    maxWidth: '240px'
  },
  sectionSelect: {
    appearance: 'none',
    padding: '12px 40px 12px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
    fontSize: '0.9375rem',
    fontWeight: '600',
    color: 'var(--text-primary)',
    backgroundColor: '#ffffff',
    width: '100%',
    cursor: 'pointer',
    outline: 'none',
    transition: 'all 0.2s'
  },
  dropdownArrow: {
    position: 'absolute',
    right: '16px',
    top: '50%',
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
    color: 'var(--text-muted)',
    display: 'flex',
    alignItems: 'center'
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
    gap: 'var(--space-8)'
  },
  infoMessage: {
    gridColumn: '1 / -1',
    padding: 'var(--space-16)',
    textAlign: 'center',
    color: 'var(--text-muted)'
  },
  footerActions: {
    marginTop: 'var(--space-12)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 'var(--space-4)'
  },
  loadMoreBtn: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    color: 'var(--text-primary)',
    padding: '12px 24px',
    borderRadius: 'var(--radius-md)',
    fontWeight: '700',
    fontSize: '0.875rem'
  },
  showingText: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
  },
  footer: {
    padding: 'var(--space-8) 0',
    borderTop: '1px solid var(--border-color)',
    textAlign: 'center',
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--bg-surface)'
  },
  authWall: {
    padding: 'var(--space-20) 0',
    display: 'flex',
    justifyContent: 'center'
  },
  authCard: {
    maxWidth: '500px',
    textAlign: 'center',
    padding: 'var(--space-12)',
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--border-color)'
  },
  authTitle: {
    fontSize: '1.75rem',
    fontWeight: '800',
    marginBottom: 'var(--space-4)',
    color: 'var(--text-primary)'
  },
  authDesc: {
    fontSize: '1rem',
    color: 'var(--text-secondary)',
    marginBottom: 'var(--space-8)',
    lineHeight: '1.6'
  },
  loginBtn: {
    padding: '14px 32px',
    backgroundColor: 'var(--gu-red)',
    color: '#ffffff',
    borderRadius: 'var(--radius-md)',
    fontSize: '1rem',
    fontWeight: '700'
  },
  viewSwitcher: {
    display: 'flex',
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: '4px',
    borderRadius: 'var(--radius-md)',
    gap: '4px',
    marginLeft: 'auto'
  },
  viewBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)',
    padding: '6px 12px',
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    transition: 'all 0.2s'
  },
  viewBtnActive: {
    backgroundColor: '#ffffff',
    color: 'var(--text-primary)',
    boxShadow: 'var(--shadow-sm)'
  }
};

export default RoadmapPage;
