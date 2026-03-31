import { useEffect, useState } from 'react';
import Navbar from '../../components/Navbar';
import FeatureCard from '../../components/FeatureCard';
import { getFeatures } from '../../api/features';
import { getSections } from '../../api/sections';

const RoadmapPage = () => {
  const [features, setFeatures] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: '', section: '', search: '' });

  const fetchData = async () => {
    try {
      const [fData, sData] = await Promise.all([
        getFeatures(filter),
        getSections()
      ]);
      setFeatures(fData);
      setSections(sData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filter]);

  return (
    <div style={styles.page}>
      <Navbar />
      
      {/* 1. Asymmetric Hero - Senior Frontend Architect Directive */}
      <header style={styles.hero}>
        <div className="container" style={styles.heroContent}>
          <div style={styles.heroText}>
            <h1>Have Your Say</h1>
            <p style={styles.heroSubtitle}>
              Vote on existing ideas or see what our campus tech teams are building for you this semester.
            </p>
          </div>
          <div style={styles.heroGlow}></div>
        </div>
      </header>

      <main className="container" style={styles.main}>
        {/* 2. Filters Sidebar / Top hybrid */}
        <aside style={styles.sidebar}>
          <div style={styles.filterSection}>
            <h3>Search</h3>
            <input 
              type="text" 
              placeholder="Filter by keyword..." 
              value={filter.search}
              onChange={(e) => setFilter(prev => ({ ...prev, search: e.target.value }))}
              style={styles.input}
            />
          </div>

          <div style={styles.filterSection}>
            <h3>Status</h3>
            <select 
              value={filter.status}
              onChange={(e) => setFilter(prev => ({ ...prev, status: e.target.value }))}
              style={styles.select}
            >
              <option value="">All Statuses</option>
              <option value="under_review">Under Review</option>
              <option value="planned">Planned</option>
              <option value="in_progress">In Progress</option>
              <option value="launched">Launched</option>
            </select>
          </div>

          <div style={styles.filterSection}>
            <h3>Section</h3>
            <div style={styles.sectionGrid}>
              <button 
                onClick={() => setFilter(prev => ({ ...prev, section: '' }))}
                style={{ ...styles.sectionBtn, backgroundColor: filter.section === '' ? 'var(--gu-red)' : 'var(--gu-black)' }}
              >
                All Applications
              </button>
              {sections.map(s => (
                <button 
                  key={s.id}
                  onClick={() => setFilter(prev => ({ ...prev, section: s.id }))}
                  style={{ 
                    ...styles.sectionBtn, 
                    backgroundColor: filter.section === s.id ? s.color : 'var(--gu-black)',
                    borderColor: s.color
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* 3. Features Feed (Staggered Reveal Ready) */}
        <div style={styles.feed}>
          {loading ? (
            <div style={styles.message}>Loading Griffith Roadmap...</div>
          ) : features.length > 0 ? (
            features.map((f, i) => (
              <div key={f.id} className={`stagger-${(i % 5) + 1}`} data-reveal="visible">
                <FeatureCard feature={f} onUpdate={fetchData} />
              </div>
            ))
          ) : (
            <div style={styles.message}>No features match your current filters.</div>
          )}
        </div>
      </main>

      <footer style={styles.footer}>
        <div className="container" style={styles.footerInner}>
          &copy; {new Date().getFullYear()} Griffith University — Roadmap & Feature Requests
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
    backgroundColor: 'var(--bg-base)',
    color: 'var(--text-primary)'
  },
  hero: {
    backgroundColor: 'var(--gu-black)',
    color: '#fff',
    padding: 'var(--space-12) 0',
    position: 'relative',
    overflow: 'hidden',
    borderBottom: '4px solid var(--gu-gold)'
  },
  heroContent: {
    position: 'relative',
    zIndex: 2,
    display: 'flex',
    alignItems: 'center'
  },
  heroText: {
    maxWidth: '70%', // Asymmetric Narrrative
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)'
  },
  heroSubtitle: {
    fontSize: '1.5rem',
    color: 'var(--gu-gold)',
    maxWidth: '600px',
    lineHeight: '1.3'
  },
  heroGlow: {
    position: 'absolute',
    top: '-50%',
    right: '-10%',
    width: '60%',
    height: '200%',
    background: 'radial-gradient(circle, rgba(232,52,28,0.2) 0%, rgba(0,0,0,0) 60%)',
    transform: 'rotate(-15deg)'
  },
  main: {
    flex: 1,
    padding: 'var(--space-12) var(--space-6)',
    display: 'grid',
    gridTemplateColumns: 'minmax(280px, 1fr) 3fr', // Asymmetric grid
    gap: 'var(--space-12)',
    alignItems: 'start'
  },
  sidebar: {
    position: 'sticky',
    top: 'var(--space-16)', // Below fixed navbar
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-8)'
  },
  filterSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)'
  },
  feed: {
    display: 'flex',
    flexDirection: 'column'
  },
  input: {
    padding: 'var(--space-4)',
    border: '2px solid var(--gu-black)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '1rem'
  },
  select: {
    padding: 'var(--space-4)',
    border: '2px solid var(--gu-black)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '1rem',
    backgroundColor: '#fff'
  },
  sectionGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: 'var(--space-2)'
  },
  sectionBtn: {
    textAlign: 'left',
    padding: 'var(--space-3) var(--space-4)',
    color: '#fff',
    fontSize: '0.8rem',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    border: '2px solid transparent',
    transition: 'all 0.2s ease'
  },
  message: {
    padding: 'var(--space-12)',
    textAlign: 'center',
    fontSize: '1.25rem',
    color: 'var(--text-muted)'
  },
  footer: {
    backgroundColor: 'var(--gu-black)',
    color: 'rgba(255,255,255,0.4)',
    padding: 'var(--space-8) 0',
    fontSize: '0.875rem'
  },
  footerInner: {
    textAlign: 'center'
  }
};

export default RoadmapPage;
