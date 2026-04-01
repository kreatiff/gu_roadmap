const StatusBadge = ({ status }) => {
  const labels = {
    under_review: 'Under Consideration',
    planned: 'Coming Soon',
    in_progress: 'Active Development',
    launched: 'Released',
    declined: 'Declined'
  };

  const colors = {
    under_review: '#64748b',
    planned: '#e8341c', 
    in_progress: '#ea580c',
    launched: '#059669',
    declined: '#000'
  };

  const bgColors = {
    under_review: '#f1f5f9',
    planned: '#fff1f0',
    in_progress: '#fff7ed',
    launched: '#ecfdf5',
    declined: '#f8fafc'
  };

  return (
    <span style={{
      ...styles.badge,
      color: colors[status] || '#64748b',
      backgroundColor: bgColors[status] || '#f1f5f9'
    }}>
      {labels[status] || status}
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
