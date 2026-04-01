import { useEffect, useState } from 'react';
import { getFeatureById } from '../api/features';
import VoteButton from './VoteButton';
import StatusBadge from './StatusBadge';
import { useAuth } from '../contexts/AuthContext';

const FeatureDetailModal = ({ featureId, onClose, onUpdate }) => {
  const [feature, setFeature] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        setLoading(true);
        const data = await getFeatureById(featureId);
        setFeature(data);
      } catch (err) {
        setError('Could not load feature details.');
      } finally {
        setLoading(false);
      }
    };

    if (featureId) {
      fetchDetail();
      // Lock scroll
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [featureId]);

  if (!featureId) return null;

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button style={styles.closeBtn} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={styles.closeIcon}>
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        {loading ? (
          <div style={styles.loading}>Loading details...</div>
        ) : error ? (
          <div style={styles.error}>{error}</div>
        ) : (
          <div style={styles.container}>
            <div style={styles.header}>
              <div style={styles.badgeRow}>
                <StatusBadge status={feature.status} />
                {feature.section_name && <span style={styles.sectionLabel}>{feature.section_name}</span>}
              </div>
              <h1 style={styles.title}>{feature.title}</h1>
            </div>

            <div style={styles.content}>
               <div style={styles.mainInfo}>
                  <p style={styles.description}>
                    {feature.description || 'No detailed description available for this request.'}
                  </p>
                  
                  {feature.tags && feature.tags.length > 0 && (
                    <div style={styles.tags}>
                      {feature.tags.map((tag, i) => (
                        <span key={i} style={styles.tag}>#{tag}</span>
                      ))}
                    </div>
                  )}
               </div>

               <aside style={styles.sidebar}>
                  <div style={styles.voteSection}>
                    <h3 style={styles.sidebarTitle}>Upvotes</h3>
                    <div style={styles.voteWrapper}>
                      <VoteButton 
                        featureId={feature.id} 
                        initialCount={feature.vote_count} 
                        initialVoted={feature.user_voted}
                        onUpdate={onUpdate}
                        large={true}
                      />
                    </div>
                    {!isAuthenticated && (
                      <p style={styles.votePrompt}>Login to support this feature</p>
                    )}
                  </div>

                  <div style={styles.activitySection}>
                     <h3 style={styles.sidebarTitle}>Status Details</h3>
                     <div style={styles.statusInfo}>
                        <div style={styles.infoItem}>
                           <span style={styles.infoLabel}>Timeline</span>
                           <span style={styles.infoValue}>Requested {new Date(feature.created_at).toLocaleDateString()}</span>
                        </div>
                     </div>
                  </div>
               </aside>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 'var(--space-4)'
  },
  modal: {
    backgroundColor: '#ffffff',
    borderRadius: 'var(--radius-xl)',
    width: '100%',
    maxWidth: '800px',
    maxHeight: '90vh',
    overflowY: 'auto',
    position: 'relative',
    boxShadow: 'var(--shadow-lg)',
    animation: 'modalSlideUp 0.3s ease-out'
  },
  closeBtn: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    cursor: 'pointer',
    zIndex: 10
  },
  closeIcon: {
    width: '18px',
    height: '18px',
    color: '#6b7280'
  },
  container: {
    padding: 'var(--space-10)'
  },
  header: {
    marginBottom: 'var(--space-8)',
    borderBottom: '1px solid var(--border-color)',
    paddingBottom: 'var(--space-6)'
  },
  badgeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-3)',
    marginBottom: 'var(--space-4)'
  },
  sectionLabel: {
    fontSize: '0.75rem',
    fontWeight: '800',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  title: {
    fontSize: '2rem',
    fontWeight: '800',
    color: 'var(--text-primary)',
    lineHeight: '1.2',
    letterSpacing: '-0.03em'
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 240px',
    gap: 'var(--space-10)'
  },
  mainInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-6)'
  },
  description: {
    fontSize: '1.125rem',
    lineHeight: '1.6',
    color: 'var(--text-secondary)'
  },
  tags: {
    display: 'flex',
    gap: 'var(--space-3)',
    flexWrap: 'wrap',
    marginTop: 'var(--space-4)'
  },
  tag: {
    backgroundColor: '#f3f4f6',
    padding: '4px 10px',
    borderRadius: '4px',
    fontSize: '0.8125rem',
    fontWeight: '600',
    color: 'var(--text-primary)'
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-8)'
  },
  sidebarTitle: {
    fontSize: '0.875rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: 'var(--space-3)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  voteSection: {
    padding: 'var(--space-6)',
    backgroundColor: '#f9fafb',
    borderRadius: 'var(--radius-lg)',
    textAlign: 'center'
  },
  voteWrapper: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: 'var(--space-4)'
  },
  votePrompt: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)'
  },
  statusInfo: {
    backgroundColor: '#ffffff',
    border: '1px solid var(--border-color)',
    padding: 'var(--space-4)',
    borderRadius: 'var(--radius-md)'
  },
  infoItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  infoLabel: {
    fontSize: '0.625rem',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase'
  },
  infoValue: {
    fontSize: '0.8125rem',
    fontWeight: '600'
  }
};

export default FeatureDetailModal;
