import { BadgeCheck } from 'lucide-react';

/**
 * A verified badge — blue circle with a white BadgeCheck icon from Lucide.
 */
const VerifiedBadge = ({ size = 18, className = '', ...props }) => (
  <span
    className={className}
    style={{
      width: size,
      height: size,
      backgroundColor: '#1d9bf0',
      borderRadius: '50%',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    }}
    {...props}
  >
    <BadgeCheck size={Math.round(size * 0.8)} color="white" strokeWidth={2.5} />
  </span>
);

export default VerifiedBadge;
