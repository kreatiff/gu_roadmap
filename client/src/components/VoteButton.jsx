import { useState } from 'react';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const VoteButton = ({ featureId, initialCount, initialVoted, onUpdate, large = false }) => {
  const { isAuthenticated, login } = useAuth();
  const [voted, setVoted] = useState(initialVoted);
  const [count, setCount] = useState(initialCount);
  const [loading, setLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const handleVote = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!isAuthenticated) {
      login();
      return;
    }

    if (loading) return;
    setLoading(true);

    try {
      if (voted) {
        await api(`/api/features/${featureId}/vote`, { method: 'DELETE' });
        setVoted(false);
        setCount(prev => prev - 1);
      } else {
        await api(`/api/features/${featureId}/vote`, { method: 'POST' });
        setVoted(true);
        setCount(prev => prev + 1);
        // Trigger "cool animation" on success
        setIsAnimating(true);
        setTimeout(() => setIsAnimating(false), 600);
      }
      if (onUpdate) onUpdate();
    } catch (err) {
      console.error('Voting failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const boxStyle = large ? styles.upvoteBoxLarge : styles.upvoteBox;

  return (
    <button 
      onClick={handleVote} 
      disabled={loading}
      className={isAnimating ? 'vote-pulse' : ''}
      style={{
        ...boxStyle,
        backgroundColor: voted ? 'var(--gu-red)' : 'transparent',
        borderColor: voted ? 'var(--gu-red)' : 'var(--border-color)',
        color: voted ? '#ffffff' : 'var(--text-primary)',
        transform: isAnimating ? 'scale(1.2)' : 'scale(1)'
      }}
      title={voted ? 'Remove Vote' : 'Upvote'}
    >
      <svg style={large ? styles.iconLarge : styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 15l-6-6-6 6"/>
      </svg>
      <span style={large ? styles.countLarge : styles.count}>{count}</span>
    </button>
  );
};

const styles = {
  upvoteBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '2px',
    width: '46px',
    padding: '6px 4px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-color)',
    transition: 'all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    cursor: 'pointer'
  },
  upvoteBoxLarge: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    width: '80px',
    padding: '12px 8px',
    borderRadius: 'var(--radius-lg)',
    border: '2px solid var(--border-color)',
    transition: 'all 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
    cursor: 'pointer'
  },
  icon: {
    width: '16px',
    height: '16px'
  },
  iconLarge: {
    width: '24px',
    height: '24px'
  },
  count: {
    fontSize: '0.8125rem',
    fontWeight: '700',
    lineHeight: '1'
  },
  countLarge: {
    fontSize: '1.25rem',
    fontWeight: '800',
    lineHeight: '1'
  }
};

// Add global styles for animation if not already present
if (typeof document !== 'undefined') {
  const styleTag = document.getElementById('vote-animations');
  if (!styleTag) {
     const style = document.createElement('style');
     style.id = 'vote-animations';
     style.innerHTML = `
       @keyframes votePulse {
         0% { transform: scale(1); }
         30% { transform: scale(1.35); }
         100% { transform: scale(1); }
       }
       .vote-pulse {
         animation: votePulse 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
       }
       @keyframes modalSlideUp {
         from { transform: translateY(20px); opacity: 0; }
         to { transform: translateY(0); opacity: 1; }
       }
     `;
     document.head.appendChild(style);
  }
}

export default VoteButton;
