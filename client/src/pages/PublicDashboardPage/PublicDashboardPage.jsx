import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { getDashboardBySlug, getDashboardMeta } from '../../api/dashboards';
import RoadmapPage from '../RoadmapPage/RoadmapPage';
import DashboardPasswordGate from '../../components/DashboardPasswordGate/DashboardPasswordGate';
import Navbar from '../../components/Navbar';
import styles from './PublicDashboardPage.module.css';

const PublicDashboardPage = () => {
  const { slug } = useParams();
  const [dashboard, setDashboard] = useState(null);
  const [scopedMeta, setScopedMeta] = useState(null);
  const [error, setError] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  useEffect(() => {
    getDashboardBySlug(slug)
      .then(d => {
        setDashboard(d);
        if (d.is_protected) {
          const token = sessionStorage.getItem(`dashboard_token_${slug}`);
          if (token) {
            // Validate token by attempting to fetch meta before unlocking
            getDashboardMeta(slug)
              .then(meta => {
                setScopedMeta(meta);
                setUnlocked(true);
              })
              .catch(() => {
                sessionStorage.removeItem(`dashboard_token_${slug}`);
                setUnlocked(false);
              });
          } else {
            setUnlocked(false);
          }
        } else {
          handleUnlock(slug);
        }
      })
      .catch(() => setError(true));
  }, [slug]);

  const handleUnlock = async (dashSlug) => {
    setUnlocked(true);
    try {
      const meta = await getDashboardMeta(dashSlug);
      setScopedMeta(meta);
    } catch (err) {
      console.error('Failed to fetch dashboard meta:', err);
      // Non-fatal: fall back to global stages
      setScopedMeta({ stages: [] });
    }
  };

  if (error) {
    return (
      <div className={styles.page}>
        <Navbar />
        <div className={styles.error}>
          <h1 className={styles.errorCode}>404</h1>
          <p className={styles.errorMessage}>Dashboard not found.</p>
          <a href="/" className={styles.errorLink}>← Back to Public Roadmap</a>
        </div>
        <footer className={styles.footer}>
          <div className="container">
            &copy; {new Date().getFullYear()} Griffith University — Roadmap
          </div>
        </footer>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className={styles.page}>
        <Navbar />
        <div className={styles.loading}>
          <div className={styles.spinner}></div>
          <p className={styles.loadingText}>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (dashboard.is_protected && !unlocked) {
    return (
      <DashboardPasswordGate
        slug={slug}
        onUnlocked={() => handleUnlock(slug)}
      />
    );
  }

  return (
    <RoadmapPage
      initialFilters={dashboard.filters}
      dashboardName={dashboard.name}
      isDashboard
      scopedMeta={scopedMeta}
      availableViews={dashboard.available_views}
      dashboardSlug={slug}
    />
  );
};

export default PublicDashboardPage;
