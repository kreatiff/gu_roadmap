import StatusBadge from './StatusBadge';
import VoteButton from './VoteButton';
import { castVote, removeVote } from '../api/votes';
import { useState } from 'react';

const FeatureCard = ({ feature, onUpdate }) => {
  const [loading, setLoading] = useState(false);

  const handleVote = async () => {
    setLoading(true);
    try {
      await castVote(feature.id);
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  const handleUnvote = async () => {
    setLoading(true);
    try {
      await removeVote(feature.id);
      onUpdate();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.card} data-reveal="visible">
      {/* 1. Vote Side (Alignment tension 90/10) */}
      <div style={styles.voteColumn}>
        <VoteButton 
          count={feature.vote_count} 
          userVoted={feature.user_voted} 
          onVote={handleVote} 
          onUnvote={handleUnvote}
          loading={loading}
        />
      </div>

      {/* 2. Content Column */}
      <div style={styles.contentColumn}>
        <div style={styles.header}>
          <div style={{ ...styles.section, backgroundColor: feature.section_color || '#e2e8f0' }}>
            {feature.section_name}
          </div>
          <StatusBadge status={feature.status} />
        </div>

        <h3 style={styles.title}>{feature.title}</h3>
        <p style={styles.description}>{feature.description}</p>
        
        <div style={styles.footer}>
          {feature.tags && feature.tags.map(tag => (
            <span key={tag} style={styles.tag}>#{tag}</span>
          ))}
          {feature.pinned === 1 && (
            <span style={styles.pinned}>★ Pinned</span>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  card: {
    display: 'flex',
    gap: 'var(--space-6)',
    backgroundColor: 'var(--bg-surface)',
    border: '2px solid var(--gu-black)',
    padding: 'var(--space-6)',
    color: 'var(--text-primary)',
    marginBottom: 'var(--space-6)',
    boxShadow: 'var(--shadow-md)', // Sharp brutalist shadow
    position: 'relative'
  },
  voteColumn: {
    display: 'flex',
    alignItems: 'flex-start'
  },
  contentColumn: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--space-2)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px'
  },
  section: {
    padding: '2px 8px',
    fontSize: '0.65rem',
    textTransform: 'uppercase',
    fontWeight: 'bold',
    color: '#fff'
  },
  title: {
    fontSize: '1.25rem',
    color: 'var(--gu-black)',
    textTransform: 'none', // Override global for readability in body content
    letterSpacing: '-0.5px'
  },
  description: {
    fontSize: '0.95rem',
    color: 'var(--text-secondary)',
    lineHeight: '1.5'
  },
  footer: {
    marginTop: 'var(--space-4)',
    display: 'flex',
    gap: 'var(--space-4)',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  tag: {
    fontSize: '0.75rem',
    color: 'var(--gu-red)',
    fontWeight: 'bold'
  },
  pinned: {
    fontSize: '0.75rem',
    color: 'var(--gu-gold)',
    fontWeight: 'bold',
    textTransform: 'uppercase'
  }
};

export default FeatureCard;
