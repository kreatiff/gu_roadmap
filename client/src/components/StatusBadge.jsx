const StatusBadge = ({ status }) => {
  const labels = {
    under_review: 'Under Review',
    planned: 'Planned',
    in_progress: 'In Progress',
    launched: 'Launched',
    declined: 'Declined'
  };

  const colors = {
    under_review: 'var(--status-under-review)',
    planned: 'var(--status-planned)',
    in_progress: 'var(--status-in-progress)',
    launched: 'var(--status-launched)',
    declined: '#000'
  };

  return (
    <span style={{
      ...styles.badge,
      backgroundColor: colors[status] || '#ccc'
    }}>
      {labels[status] || status}
    </span>
  );
};

const styles = {
  badge: {
    padding: '0.25rem 0.5rem',
    fontSize: '0.7rem',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    color: '#fff',
    display: 'inline-block',
    letterSpacing: '0.05em'
  }
};

export default StatusBadge;
