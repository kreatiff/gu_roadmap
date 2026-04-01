import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import VoteButton from './VoteButton';
import StatusBadge from './StatusBadge';

const FeatureCard = ({ feature, onClick }) => {
  const [isHovered, setIsHovered] = useState(false);

  // Helper to parse tags
  const tags = typeof feature.tags === 'string' ? JSON.parse(feature.tags) : feature.tags || [];

  return (
    <div 
      style={{
        ...styles.card,
        transform: isHovered ? 'translateY(-4px)' : 'none',
        boxShadow: isHovered ? 'var(--shadow-md)' : 'var(--shadow-card)',
        cursor: 'pointer'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      <div style={styles.header}>
        <div style={styles.badgeContainer}>
            <StatusBadge 
              status={feature.stage_slug || feature.status} 
              name={feature.stage_name} 
              color={feature.stage_color} 
            />
        </div>
        <div style={styles.voteIndicator}>
           <svg style={styles.voteIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 19V5m-7 7l7-7 7 7"/>
           </svg>
           <span>{feature.vote_count}</span>
        </div>
      </div>

      <div style={styles.body}>
        <h2 style={styles.title}>{feature.title}</h2>
        <p style={styles.description}>
          {feature.description || 'No description provided for this roadmap feature.'}
        </p>
      </div>

      <div style={styles.footer}>
        <div style={styles.sectionInfo}>
           {feature.section_name && (
             <span style={styles.sectionValue}>
               <svg style={styles.sectionIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                 <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                 <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
               </svg>
               {feature.section_name}
             </span>
           )}
        </div>
        <div style={styles.meta}>
           <span style={styles.commentCount}>Click to view details</span>
        </div>
      </div>
    </div>
  );
};

const styles = {
  card: {
    backgroundColor: 'var(--bg-surface)',
    border: '1px solid var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    padding: 'var(--space-6)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-4)',
    transition: 'all 0.2s ease',
    boxShadow: 'var(--shadow-card)',
    position: 'relative'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start'
  },
  badgeContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)',
    alignItems: 'flex-start'
  },
  sectionLabel: {
    fontSize: '0.625rem',
    fontWeight: '800',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  body: {
    flex: 1
  },
  title: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    lineHeight: '1.3',
    marginBottom: 'var(--space-2)',
    letterSpacing: '-0.02em'
  },
  description: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden'
  },
  footer: {
    marginTop: 'var(--space-4)',
    paddingTop: 'var(--space-4)',
    borderTop: '1px solid var(--border-color)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  sectionInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-2)'
  },
  sectionValue: {
    fontSize: '0.75rem',
    fontWeight: '700',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    display: 'flex',
    alignItems: 'center',
    gap: '6px'
  },
  sectionIcon: {
    width: '12px',
    height: '12px',
    color: 'var(--gu-red)',
    opacity: 0.8
  },
  meta: {
    fontSize: '0.75rem',
    color: 'var(--text-muted)',
    fontWeight: '500'
  },
  voteIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--space-1)',
    backgroundColor: 'var(--bg-muted)',
    padding: '4px 8px',
    borderRadius: '12px',
    fontSize: '0.8125rem',
    fontWeight: '700',
    color: 'var(--text-secondary)'
  },
  voteIcon: {
    width: '14px',
    height: '14px',
    color: 'var(--gu-red)'
  }
};

export default FeatureCard;
