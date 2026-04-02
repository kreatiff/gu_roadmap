import * as Icons from 'lucide-react';

const CategoryIcon = ({ name, color, size = 16, className = "" }) => {
  const IconComponent = Icons[name] || Icons.Briefcase || Icons.HelpCircle;
  
  if (!IconComponent) {
    return <div style={{ width: size, height: size, backgroundColor: color, borderRadius: '50%' }} className={className} />;
  }

  return (
    <IconComponent 
      size={size} 
      color={color} 
      className={className}
      strokeWidth={2.5}
    />
  );
};

export default CategoryIcon;
