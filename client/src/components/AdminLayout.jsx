import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, LayoutTemplate, AlignJustify, ClipboardList, Shield, Users, Database, Eye, LogOut, ChevronLeft, ChevronRight, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import InviteUserPanel from '../pages/admin/AdminUsersPage/InviteUserPanel';
import styles from './AdminLayout.module.css';

const AdminLayout = ({ children }) => {
  const { user: currentUser, logout, isSuperAdmin } = useAuth();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

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
      <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}>
        <div className={styles.sidebarHeader}>
          <div className={`${styles.brand} ${collapsed ? styles.brandCollapsed : ''}`}>
            <h2 className={styles.brandTitle}>Admin Portal</h2>
            <p className={styles.brandSubtitle}>Feature Management</p>
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className={styles.collapseToggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            type="button"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        <nav className={styles.nav}>
          {menuItems.map((item) => {
            const Icon = item.Icon;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`${styles.navItem} ${location.pathname === item.path ? styles.navItemActive : ''} ${collapsed ? styles.navItemCollapsed : ''}`}
                title={collapsed ? item.label : undefined}
              >
                <Icon size={18} strokeWidth={2} className={styles.navIcon} />
                <span className={collapsed ? styles.navLabelHidden : ''}>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <button
            onClick={() => setProfileOpen(true)}
            className={`${styles.profileBtn} ${collapsed ? styles.profileBtnCollapsed : ''}`}
            title={collapsed ? 'My Profile' : undefined}
          >
            <User size={18} strokeWidth={2} className={styles.profileIcon} />
            <span className={collapsed ? styles.navLabelHidden : ''}>My Profile</span>
          </button>
          <button onClick={logout} className={`${styles.logoutBtn} ${collapsed ? styles.logoutBtnCollapsed : ''}`}>
            <LogOut size={18} strokeWidth={2} className={styles.logoutIcon} />
            <span className={collapsed ? styles.navLabelHidden : ''}>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={`${styles.mainContent} ${collapsed ? styles.mainContentCollapsed : ''}`}>
        {children}
      </main>

      {/* My Profile Modal */}
      <InviteUserPanel
        isOpen={profileOpen}
        mode="edit"
        user={currentUser}
        onClose={() => setProfileOpen(false)}
        onSuccess={() => setProfileOpen(false)}
        currentUser={currentUser}
        isSuperAdmin={isSuperAdmin}
      />
    </div>
  );
};

export default AdminLayout;
