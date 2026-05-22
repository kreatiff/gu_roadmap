import { useState, useRef, useEffect } from 'react';
import { MoreVertical, Pencil, Lock, Power, CheckCircle } from 'lucide-react';
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
        <MoreVertical size={18} strokeWidth={2} />
      </button>

      {isOpen && (
        <div className={styles.dropdownMenu}>
          <button className={styles.dropdownItem} onClick={handleEditClick}>
            <Pencil size={16} strokeWidth={2} className={styles.dropdownIcon} />
            Edit User
          </button>

          <button className={styles.dropdownItem} onClick={handleResetClick}>
            <Lock size={16} strokeWidth={2} className={styles.dropdownIcon} />
            Reset Password
          </button>

          <div className={styles.dropdownDivider} />

          <button
            className={`${styles.dropdownItem} ${user.status === 'active' ? styles.dropdownItemDanger : styles.dropdownItemSuccess}`}
            onClick={handleToggleStatusClick}
            disabled={isSelf}
            title={isSelf ? "You cannot deactivate your own account." : ""}
          >
            {user.status === 'active' ? (
              <Power size={16} strokeWidth={2} className={styles.dropdownIcon} />
            ) : (
              <CheckCircle size={16} strokeWidth={2} className={styles.dropdownIcon} />
            )}
            {user.status === 'active' ? 'Deactivate User' : 'Activate User'}
          </button>
        </div>
      )}
    </div>
  );
};

export default UserRowMenu;
