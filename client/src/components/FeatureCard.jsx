import { Link } from 'react-router-dom';
import VoteButton from './VoteButton';
import StatusBadge from './StatusBadge';
import styles from './FeatureCard.module.css';

const FeatureCard = ({ feature, onClick }) => {
  const { status, stage_slug, stage_name, stage_color } = feature;

  return (
    <div className={styles.card} onClick={onClick}>
      <div className={styles.header}>
        <div className={styles.badgeContainer}>
            <StatusBadge 
              status={stage_slug || status} 
              name={stage_name} 
              color={stage_color} 
            />
        </div>
        <div className={styles.voteIndicator}>
           <svg className={styles.voteIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5m-7 7l7-7 7 7"/>
           </svg>
           <span>{feature.vote_count}</span>
        </div>
      </div>

      <div className={styles.body}>
        <h2 className={styles.title}>{feature.title}</h2>
        <p className={styles.description}>
          {feature.description || 'No description provided for this roadmap feature.'}
        </p>
      </div>

      <div className={styles.footer}>
        <div className={styles.sectionInfo}>
           {feature.section_name && (
             <span className={styles.sectionValue}>
               <svg className={styles.sectionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                 <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                 <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
               </svg>
               {feature.section_name}
             </span>
           )}
        </div>
        <div className={styles.meta}>
           <span className={styles.commentCount}>Click to view details</span>
        </div>
      </div>
    </div>
  );
};

export default FeatureCard;
