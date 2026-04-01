const StatusBadge = ({ status, name, color }) => {
  const labels = {
    under_review: 'Under Consideration',
    planned: 'Coming Soon',
    in_progress: 'Active Development',
    launched: 'Released',
    declined: 'Declined'
  };

  const defaultColors = {
    under_review: '#64748b',
    planned: '#e8341c', 
    in_progress: '#ea580c',
    launched: '#059669',
    declined: '#000'
  };

  const displayLabel = name || labels[status] || status;
  const displayColor = color || defaultColors[status] || '#64748b';
  
  // Dynamic soft background (10% opacity)
  const bgColor = `${displayColor}1a`; 

  return (
    <span style={{
      ...styles.badge,
      color: displayColor,
      backgroundColor: bgColor
    }}>
      {displayLabel}
    </span>
  );
};

const styles = {
  badge: {
    padding: '4px 10px',
    fontSize: '0.6875rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    display: 'inline-block',
    letterSpacing: '0.04em',
    borderRadius: 'var(--radius-pill)',
    whiteSpace: 'nowrap'
  }
};

export default StatusBadge;
