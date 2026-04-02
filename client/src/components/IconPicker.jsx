import { useState, useMemo } from 'react';
import * as Icons from 'lucide-react';
import styles from './IconPicker.module.css';

const ICON_LIST = [
  // Web Dev
  'Laptop', 'Code', 'Database', 'Cpu', 'Globe', 'Server', 'Smartphone', 'Tablet', 'Monitor', 'Cloud', 
  'Layers', 'Zap', 'Component', 'GitBranch', 'Terminal', 'Brackets', 'Binary', 'FileCode', 'Layout', 'Webhook',
  // Business
  'Briefcase', 'TrendingUp', 'PieChart', 'BarChart', 'LineChart', 'Target', 'Users', 'Rocket', 'Shield', 'DollarSign', 
  'CreditCard', 'Wallet', 'Presentation', 'Calculator', 'Building', 'Banknote', 'Landmark', 'Calendar', 'Clock', 'Handshake', 
  'Megaphone', 'Send', 'Mail', 'Phone', 'MapPin', 'BriefcaseBusiness', 'ChartBar', 'ChartPie', 'Goal', 'Strikethrough',
  // Education
  'Book', 'GraduationCap', 'School', 'Pencil', 'Lightbulb', 'Brain', 'Compass', 'Trophy', 'Star', 'Library', 
  'Notebook', 'Clarity', 'Eye', 'Heart', 'Smile', 'Flag', 'Music', 'Palette', 'Microscope', 'Atom', 
  'Globe2', 'Dna', 'Shapes', 'Sigma', 'Variable', 'Languages', 'TestTube', 'FlaskConical', 'Tablets',
  // Utility & Interface
  'Home', 'Search', 'Settings', 'Trash', 'Plus', 'Minus', 'Check', 'X', 'ChevronRight', 'ChevronDown', 
  'ChevronLeft', 'ChevronUp', 'Menu', 'Bell', 'Sun', 'Moon', 'Maximize', 'Minimize', 'Filter', 'Grid', 
  'List', 'Link', 'Share', 'MoreHorizontal', 'MoreVertical', 'Activity', 'Anchor', 'Archive', 'Award', 'Box',
  'Camera', 'Lock', 'Unlock', 'Power', 'Wifi', 'Battery', 'Bluetooth', 'Trash2', 'Edit', 'Save'
];

const IconPicker = ({ selectedIcon, onSelect, color = '#64748b' }) => {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const VALID_ICONS = useMemo(() => {
    return ICON_LIST.filter(name => !!Icons[name]);
  }, []);

  const filteredIcons = useMemo(() => {
    return VALID_ICONS.filter(name => 
      name.toLowerCase().includes(search.toLowerCase())
    );
  }, [search, VALID_ICONS]);

  const SelectedIconComponent = Icons[selectedIcon] || Icons.Briefcase || Icons.HelpCircle;

  return (
    <div className={styles.container}>
      <button 
        type="button" 
        className={styles.trigger}
        onClick={() => setIsOpen(!isOpen)}
        style={{ borderColor: color }}
      >
        {SelectedIconComponent ? (
          <SelectedIconComponent size={18} color={color} strokeWidth={2.5} />
        ) : (
          <div style={{ width: 18, height: 18, backgroundColor: color, borderRadius: '50%' }} />
        )}
        <span className={styles.triggerLabel}>{selectedIcon}</span>
        <Icons.ChevronDown size={14} className={`${styles.arrow} ${isOpen ? styles.arrowOpen : ''}`} />
      </button>

      {isOpen && (
        <div className={styles.dropdown}>
          <div className={styles.searchWrapper}>
            <Icons.Search size={14} className={styles.searchIcon} />
            <input 
              type="text" 
              placeholder="Search 100+ icons..." 
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={styles.searchInput}
              autoFocus
            />
          </div>
          <div className={styles.grid}>
            {filteredIcons.map(name => {
              const Icon = Icons[name];
              if (!Icon) return null;
              return (
                <button
                  key={name}
                  type="button"
                  className={`${styles.iconBtn} ${selectedIcon === name ? styles.iconBtnActive : ''}`}
                  onClick={() => {
                    onSelect(name);
                    setIsOpen(false);
                    setSearch('');
                  }}
                  title={name}
                >
                  <Icon size={18} strokeWidth={2} />
                </button>
              );
            })}
            {filteredIcons.length === 0 && (
              <div className={styles.noResults}>No matching icons</div>
            )}
          </div>
        </div>
      )}
      
      {isOpen && <div className={styles.overlay} onClick={() => setIsOpen(false)} />}
    </div>
  );
};

export default IconPicker;
