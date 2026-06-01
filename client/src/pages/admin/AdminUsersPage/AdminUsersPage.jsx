import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Plus, Search } from 'lucide-react';
import { useAuth } from '../../../contexts/AuthContext';
import { listUsers, resetPassword, updateUser } from '../../../api/users';
import AdminLayout from '../../../components/AdminLayout';
import UserTable from './UserTable';
import InviteUserPanel from './InviteUserPanel';
import styles from './AdminUsersPage.module.css';

// ── Reset Password Modal ────────────────────────────────────────────────────────

const ResetPasswordModal = ({ user, onClose, onSuccess }) => {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!user) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      await resetPassword(user.id, newPassword);
      onSuccess();
    } catch (err) {
      setError(err?.error || err?.message || 'Failed to reset password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2>Reset Password</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <X size={20} strokeWidth={2.5} />
          </button>
        </div>
        <p className={styles.modalSubtext}>
          Setting a new password for <strong>{user.name || user.email}</strong>.
        </p>
        <form onSubmit={handleSubmit} className={styles.modalForm}>
          {error && (
            <div className={styles.errorAlert}>
              <span className={styles.errorIcon}>⚠️</span>
              <span className={styles.errorMessage}>{error}</span>
            </div>
          )}
          <div className={styles.formGroup}>
            <label htmlFor="reset-password" className={styles.label}>New Password</label>
            <input
              id="reset-password"
              type="password"
              className={styles.input}
              placeholder="At least 8 characters"
              value={newPassword}
              onChange={(e) => { setNewPassword(e.target.value); if (error) setError(null); }}
              disabled={isSubmitting}
              autoComplete="new-password"
              required
            />
          </div>
          <div className={styles.formGroup}>
            <label htmlFor="reset-confirm" className={styles.label}>Confirm Password</label>
            <input
              id="reset-confirm"
              type="password"
              className={styles.input}
              placeholder="Repeat new password"
              value={confirmPassword}
              onChange={(e) => { setConfirmPassword(e.target.value); if (error) setError(null); }}
              disabled={isSubmitting}
              autoComplete="new-password"
              required
            />
          </div>
          <div className={styles.modalActions}>
            <button type="button" className={styles.buttonSecondary} onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className={styles.buttonDanger} disabled={isSubmitting}>
              {isSubmitting ? 'Resetting...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Page ───────────────────────────────────────────────────────────────────

const AdminUsersPage = () => {
  const { user: currentUser, isSuperAdmin } = useAuth();

  // List state
  const [users, setUsers] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [continuationToken, setContinuationToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [listError, setListError] = useState(null);

  // Search with 300ms debounce
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const debounceRef = useRef(null);

  // Panel/modal state
  const [panelState, setPanelState] = useState({ isOpen: false, mode: 'invite', user: null });
  const [resetTarget, setResetTarget] = useState(null);

  // ── Data Fetching ─────────────────────────────────────────────────────────────

  const fetchUsers = useCallback(async (searchTerm, token = null, append = false) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setListError(null);

    try {
      const result = await listUsers({ search: searchTerm || undefined, continuationToken: token, pageSize: 20 });
      if (append) {
        setUsers((prev) => [...prev, ...result.users]);
      } else {
        setUsers(result.users);
      }
      setTotalCount(result.totalCount);
      setContinuationToken(result.continuationToken);
    } catch (err) {
      setListError(err?.error || 'Failed to load users.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Initial load + on search change
  useEffect(() => {
    fetchUsers(search);
  }, [search, fetchUsers]);

  // Debounced search
  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchInput(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setSearch(val), 300);
  };

  const handleLoadMore = () => {
    if (continuationToken) fetchUsers(search, continuationToken, true);
  };

  // ── Panel / Modal Handlers ────────────────────────────────────────────────────

  const handleInviteClick = () => setPanelState({ isOpen: true, mode: 'invite', user: null });
  const handleEditUser = (user) => setPanelState({ isOpen: true, mode: 'edit', user });
  const handleClosePanel = () => setPanelState({ isOpen: false, mode: 'invite', user: null });

  const handlePanelSuccess = () => {
    handleClosePanel();
    fetchUsers(search); // Reload list after mutation
  };

  const handleResetPassword = (user) => setResetTarget(user);
  const handleCloseReset = () => setResetTarget(null);

  const handleResetSuccess = () => {
    setResetTarget(null);
    // No list reload needed — only passwordHash changed
  };

  const handleToggleStatus = async (user) => {
    if (currentUser?.id === user.id) return; // Self-guard
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    try {
      await updateUser(user.id, { status: newStatus });
      fetchUsers(search); // Reload to reflect change
    } catch (err) {
      alert(err?.error || 'Failed to update user status.');
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <AdminLayout>
      <div className={styles.pageContainer}>
        {/* ── Header ── */}
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>User Management</h1>
            <p className={styles.pageSubtitle}>
              Manage access for Griffith Roadmap.
              {!loading && (
                <span className={styles.totalCount}> {totalCount} user{totalCount !== 1 ? 's' : ''} total.</span>
              )}
            </p>
          </div>
          <button className={styles.inviteButton} onClick={handleInviteClick}>
            <Plus size={18} strokeWidth={2.5} />
            Invite User
          </button>
        </div>

        {/* ── Search Bar ── */}
        <div className={styles.searchBar}>
          <Search size={16} strokeWidth={2} className={styles.searchIcon} />
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Search by name or email..."
            value={searchInput}
            onChange={handleSearchChange}
            aria-label="Search users"
          />
        </div>

        {/* ── Content ── */}
        {loading ? (
          <div className={styles.loadingState}>
            <div className={styles.spinner} />
            <p>Loading users...</p>
          </div>
        ) : listError ? (
          <div className={styles.errorState}>
            <p>{listError}</p>
            <button className={styles.retryButton} onClick={() => fetchUsers(search)}>Retry</button>
          </div>
        ) : (
          <>
            <UserTable
              users={users}
              onEdit={handleEditUser}
              onResetPassword={handleResetPassword}
              onToggleStatus={handleToggleStatus}
              currentUser={currentUser}
            />

            {continuationToken && (
              <div className={styles.loadMoreContainer}>
                <button className={styles.loadMoreButton} onClick={handleLoadMore} disabled={loadingMore}>
                  {loadingMore ? 'Loading...' : `Load More (showing ${users.length} of ${totalCount})`}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Invite / Edit Panel ── */}
      <InviteUserPanel
        isOpen={panelState.isOpen}
        mode={panelState.mode}
        user={panelState.user}
        onClose={handleClosePanel}
        onSuccess={handlePanelSuccess}
        currentUser={currentUser}
        isSuperAdmin={isSuperAdmin}
      />

      {/* ── Reset Password Modal ── */}
      {resetTarget && (
        <ResetPasswordModal
          user={resetTarget}
          onClose={handleCloseReset}
          onSuccess={handleResetSuccess}
        />
      )}
    </AdminLayout>
  );
};

export default AdminUsersPage;
