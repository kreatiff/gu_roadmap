import { useState, useRef, useEffect } from 'react';
import styles from './AdminUsersPage.module.css';

const UserRowMenu = ({ user, onEdit, onResetPassword, onToggleStatus, currentUser }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  const isSelf = currentUser?.id === user.id;

  const handleToggle = (e) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [isOpen]);

  const handleEditClick = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    onEdit(user);
  };

  const handleResetClick = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    onResetPassword(user);
  };

  const handleToggleStatusClick = (e) => {
    e.stopPropagation();
    setIsOpen(false);
    onToggleStatus(user);
  };

  return (
    <div className={styles.menuContainer} ref={menuRef}>
      <button className={styles.menuButton} onClick={handleToggle} aria-label="User actions">
        <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="1"></circle>
          <circle cx="12" cy="5" r="1"></circle>
          <circle cx="12" cy="19" r="1"></circle>
        </svg>
      </button>
      
      {isOpen && (
        <div className={styles.dropdownMenu}>
          <button className={styles.dropdownItem} onClick={handleEditClick}>
            <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 113 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit User
          </button>
          
          <button className={styles.dropdownItem} onClick={handleResetClick}>
            <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
            </svg>
            Reset Password
          </button>
          
          <div className={styles.dropdownDivider} />
          
          <button 
            className={`${styles.dropdownItem} ${user.status === 'active' ? styles.dropdownItemDanger : styles.dropdownItemSuccess}`} 
            onClick={handleToggleStatusClick}
            disabled={isSelf}
            title={isSelf ? "You cannot deactivate your own account." : ""}
          >
            <svg className={styles.dropdownIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {user.status === 'active' ? (
                <path d="M18.36 6.64a9 9 0 1 1-12.73 0M12 2v10" />
              ) : (
                <>
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                  <polyline points="22 4 12 14.01 9 11.01" />
                </>
              )}
            </svg>
            {user.status === 'active' ? 'Deactivate User' : 'Activate User'}
          </button>
        </div>
      )}
    </div>
  );
};

export default UserRowMenu;
