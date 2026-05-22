import UserRowMenu from './UserRowMenu';
import styles from './AdminUsersPage.module.css';

const UserTable = ({ users, onEdit, onResetPassword, onToggleStatus, currentUser }) => {
  if (!users || users.length === 0) {
    return (
      <div className={styles.emptyTable}>
        <p>No users found matching the query.</p>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Name</th>
            <th className={styles.th}>Email</th>
            <th className={styles.th}>Role</th>
            <th className={styles.th}>Status</th>
            <th className={styles.th}>Created</th>
            <th className={styles.th} style={{ width: '80px', textAlign: 'right' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className={styles.tr}>
              <td className={styles.td}>
                <div className={styles.nameContainer}>
                  <div className={styles.avatar}>
                    {user.name ? user.name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <div className={styles.nameDetails}>
                    <span className={styles.nameText}>{user.name}</span>
                    {currentUser?.id === user.id && (
                      <span className={styles.selfBadge}>You</span>
                    )}
                  </div>
                </div>
              </td>
              <td className={styles.td}>
                <span className={styles.emailText}>{user.email}</span>
              </td>
              <td className={styles.td}>
                <span className={`${styles.roleBadge} ${
                  user.role === 'super_admin' ? styles.roleSuperAdmin
                  : user.role === 'admin' ? styles.roleAdmin
                  : styles.roleUser
                }`}>
                  {user.role === 'super_admin' ? 'Super Admin'
                  : user.role === 'admin' ? 'Admin'
                  : 'User'}
                </span>
              </td>
              <td className={styles.td}>
                <span className={`${styles.statusBadge} ${user.status === 'active' ? styles.statusActive : styles.statusInactive}`}>
                  {user.status === 'active' ? 'Active' : 'Inactive'}
                </span>
              </td>
              <td className={styles.td}>
                <span className={styles.dateText}>{formatDate(user.createdAt)}</span>
              </td>
              <td className={styles.td} style={{ textAlign: 'right' }}>
                <UserRowMenu
                  user={user}
                  onEdit={onEdit}
                  onResetPassword={onResetPassword}
                  onToggleStatus={onToggleStatus}
                  currentUser={currentUser}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default UserTable;
