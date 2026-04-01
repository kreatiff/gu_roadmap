import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

import RoadmapPage from './pages/RoadmapPage/RoadmapPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage/AdminDashboardPage';
import AdminFeatureFormPage from './pages/admin/AdminFeatureFormPage/AdminFeatureFormPage';
import AdminSectionsPage from './pages/admin/AdminSectionsPage/AdminSectionsPage';
import AdminStagesPage from './pages/admin/AdminStagesPage/AdminStagesPage';
import LoginSplashPage from './pages/LoginSplashPage/LoginSplashPage';

// Pages
const NotFound = () => (
  <div style={{ padding: 'var(--space-16) 0', textAlign: 'center', backgroundColor: 'var(--bg-base)', minHeight: '100vh' }}>
    <h1 style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>404 Not Found</h1>
    <p style={{ color: 'var(--text-secondary)' }}>The requested Griffith Roadmap page does not exist.</p>
    <Link to="/" style={{ display: 'inline-block', marginTop: 'var(--space-6)', fontWeight: '700' }}>← Back to Public Roadmap</Link>
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
      <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: 'var(--bg-base)', color: 'var(--text-primary)' }}>
        <p style={{ fontWeight: '700', fontSize: '1.25rem' }}>Verifying Profile...</p>
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
