import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

import RoadmapPage from './pages/RoadmapPage/RoadmapPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage/AdminDashboardPage';
import AdminFeatureFormPage from './pages/admin/AdminFeatureFormPage/AdminFeatureFormPage';
import AdminSectionsPage from './pages/admin/AdminSectionsPage/AdminSectionsPage';
import AdminStagesPage from './pages/admin/AdminStagesPage/AdminStagesPage';
import LoginSplashPage from './pages/LoginSplashPage/LoginSplashPage';
import styles from './AppRouter.module.css';

// Pages
const NotFound = () => (
  <div className={styles.notFound}>
    <h1 className={styles.h1}>404</h1>
    <p>The requested Griffith Roadmap page does not exist.</p>
    <Link to="/" className={styles.notFoundLink}>← Back to Public Roadmap</Link>
  </div>
);

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAdmin } = useAuth();
  
  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppRouter = () => {
  const { loading, isAuthenticated } = useAuth();

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.loadingSpinner}></div>
        <p className={styles.loadingText}>Verifying Profile...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginSplashPage />;
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Core Application */}
        <Route path="/" element={<RoadmapPage />} />
        
        {/* Admin Routes */}
        <Route path="/admin" element={
          <ProtectedRoute adminOnly>
            <AdminDashboardPage />
          </ProtectedRoute>
        } />
        
        <Route path="/admin/features/new" element={
          <ProtectedRoute adminOnly>
            <AdminFeatureFormPage />
          </ProtectedRoute>
        } />

        <Route path="/admin/features/:id/edit" element={
          <ProtectedRoute adminOnly>
            <AdminFeatureFormPage />
          </ProtectedRoute>
        } />

        <Route path="/admin/sections" element={
          <ProtectedRoute adminOnly>
            <AdminSectionsPage />
          </ProtectedRoute>
        } />

        <Route path="/admin/stages" element={
          <ProtectedRoute adminOnly>
            <AdminStagesPage />
          </ProtectedRoute>
        } />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
