import { useEffect, useState } from 'react';
import { getFeatureById } from '../api/features';
import FeatureDetailView from './FeatureDetailView';
import styles from './FeatureDetailModal.module.css';

const FeatureDetailModal = ({ featureId, onClose, onUpdate, feature: featureProp }) => {
  const [feature, setFeature] = useState(featureProp || null);
  const [loading, setLoading] = useState(!featureProp);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If we have a direct feature prop (preview mode), we don't need to fetch
    if (featureProp) {
      setFeature(featureProp);
      setLoading(false);
      return;
    }

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
  }, [featureId, featureProp]);

  // If no ID and no Direct Feature, it's an empty modal - do nothing
  if (!featureId && !featureProp) return null;

  const closeButton = (
    <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.closeIcon}>
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
  );

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div 
        className={styles.modal} 
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className={styles.loading}>Loading details...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : feature ? (
          <FeatureDetailView 
            feature={feature} 
            onUpdate={onUpdate} 
            closeButton={closeButton}
          />
        ) : null}
      </div>
    </div>
  );
};

export default FeatureDetailModal;
