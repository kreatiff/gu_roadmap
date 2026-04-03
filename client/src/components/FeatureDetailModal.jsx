import { useEffect, useState } from 'react';
import { getFeatureById } from '../api/features';
import VoteButton from './VoteButton';
import StatusBadge from './StatusBadge';
import RichTextViewer from './RichTextViewer';
import { useAuth } from '../contexts/AuthContext';
import styles from './FeatureDetailModal.module.css';

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
      } catch {
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
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.closeIcon}>
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>

        {loading ? (
          <div className={styles.loading}>Loading details...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : feature ? (
          <div className={styles.container}>
            <div className={styles.header}>
              <div className={styles.badgeRow}>
                <StatusBadge status={feature.status} />
                {feature.category_name && <span className={styles.categoryLabel}>{feature.category_name}</span>}
              </div>
              <h1 className={styles.title}>{feature.title}</h1>
            </div>

            <div className={styles.content}>
               <div className={styles.mainInfo}>
                  <RichTextViewer 
                    content={feature.description || 'No detailed description available for this request.'} 
                    className={styles.description}
                  />
                  
                  {feature.tags && feature.tags.length > 0 && (
                    <div className={styles.tags}>
                      {feature.tags.map((tag, i) => (
                        <span key={i} className={styles.tag}>#{tag}</span>
                      ))}
                    </div>
                  )}
               </div>

               <aside className={styles.sidebar}>
                  <div className={styles.voteSection}>
                    <h3 className={styles.sidebarTitle}>Upvotes</h3>
                    <div className={styles.voteWrapper}>
                      <VoteButton 
                        featureId={feature.id} 
                        initialCount={feature.vote_count} 
                        initialVoted={feature.user_voted}
                        onUpdate={onUpdate}
                        large={true}
                      />
                    </div>
                    {!isAuthenticated && (
                      <p className={styles.votePrompt}>Login to support this feature</p>
                    )}
                  </div>

                  <div className={styles.activitySection}>
                     <h3 className={styles.sidebarTitle}>Status Details</h3>
                     <div className={styles.statusInfo}>
                        <div className={styles.infoItem}>
                           <span className={styles.infoLabel}>Timeline</span>
                           <span className={styles.infoValue}>Requested {new Date(feature.created_at).toLocaleDateString()}</span>
                        </div>
                     </div>
                  </div>

                  {feature.gravity_score > 0 && (
                    <div className={styles.gravitySection}>
                      <h3 className={styles.sidebarTitle}>Gravity Score</h3>
                      <div className={styles.gravityValue}>
                        <span className={styles.gravityIcon}>⚡</span>
                        {feature.gravity_score}
                        <span className={styles.gravityMax}>/ 100</span>
                      </div>
                      <div className={`${styles.gravityLevel} ${
                        feature.gravity_score >= 60 ? styles.gravityHigh : 
                        feature.gravity_score >= 30 ? styles.gravityMid : 
                        styles.gravityLow
                      }`}>
                        {feature.gravity_score >= 60 ? 'High Priority' : 
                         feature.gravity_score >= 30 ? 'Medium Momentum' : 
                         'Steady'}
                      </div>
                    </div>
                  )}
               </aside>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default FeatureDetailModal;
