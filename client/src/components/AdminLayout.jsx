import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutTemplate, AlignJustify, ClipboardList, Shield, Users, Database, Eye, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import styles from './AdminLayout.module.css';

const AdminLayout = ({ children }) => {
  const { logout, isSuperAdmin } = useAuth();
  const location = useLocation();

  const menuItems = [
    { path: '/admin', label: 'Roadmap Editor', Icon: Home },
    { path: '/admin/matrix', label: 'Priority Matrix', Icon: LayoutTemplate },
    { path: '/admin/categories', label: 'Categories', Icon: AlignJustify },
    { path: '/admin/stages', label: 'Stages', Icon: ClipboardList },
    { path: '/admin/dashboards', label: 'Public Dashboards', Icon: Shield },
    { path: '/admin/metadata', label: 'Metadata', Icon: AlignJustify },
    // Super-admin-only items
    { path: '/admin/users', label: 'User Management', Icon: Users, superAdminOnly: true },
    { path: '/admin/data', label: 'Data Management', Icon: Database, superAdminOnly: true },
    { path: '/', label: 'Public View', Icon: Eye }
  ].filter(item => !item.superAdminOnly || isSuperAdmin);

  return (
    <div className={styles.adminContainer}>
      {/* Sidebar */}
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <h2 className={styles.brandTitle}>Admin Portal</h2>
          <p className={styles.brandSubtitle}>Feature Management</p>
        </div>

        <nav className={styles.nav}>
          {menuItems.map((item) => {
            const Icon = item.Icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`${styles.navItem} ${location.pathname === item.path ? styles.navItemActive : ''}`}
              >
                <Icon size={18} strokeWidth={2} className={styles.navIcon} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <button onClick={logout} className={styles.logoutBtn}>
            <LogOut size={18} strokeWidth={2} className={styles.logoutIcon} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={styles.mainContent}>
        {children}
      </main>
    </div>
  );
};

export default AdminLayout;
