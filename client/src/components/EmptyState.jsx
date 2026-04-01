const EmptyState = ({ 
  title = "No results found", 
  description = "Try adjusting your search or filters to find what you're looking for." 
}) => {
  return (
    <div style={styles.container}>
      <div style={styles.iconWrapper}>
        <svg style={styles.icon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>
      <h3 style={styles.title}>{title}</h3>
      <p style={styles.description}>{description}</p>
    </div>
  );
};

const styles = {
  container: {
    gridColumn: '1 / -1',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4rem 2rem',
    backgroundColor: 'var(--bg-surface)',
    border: '1px dashed var(--border-color)',
    borderRadius: 'var(--radius-lg)',
    textAlign: 'center'
  },
  iconWrapper: {
    width: '48px',
    height: '48px',
    borderRadius: '50%',
    backgroundColor: '#F3F4F6', // Tailwind Gray-100
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: '1rem'
  },
  icon: {
    width: '24px',
    height: '24px',
    color: 'var(--text-muted)'
  },
  title: {
    fontSize: '1.125rem',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '0.5rem'
  },
  description: {
    fontSize: '0.875rem',
    color: 'var(--text-secondary)',
    maxWidth: '400px',
    lineHeight: '1.5'
  }
};

export default EmptyState;
