import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext';

import RoadmapPage from './pages/RoadmapPage/RoadmapPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage/AdminDashboardPage';
import AdminFeatureFormPage from './pages/admin/AdminFeatureFormPage/AdminFeatureFormPage';
import AdminSectionsPage from './pages/admin/AdminSectionsPage/AdminSectionsPage';

// Pages
const NotFound = () => <div style={{ padding: '4rem', textAlign: 'center', backgroundColor: 'var(--gu-black)', color: '#fff', minHeight: '100vh' }}><h1>404 Not Found</h1><p>The requested Griffith Roadmap page does not exist.</p></div>;

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { user, loading, isAuthenticated, isAdmin } = useAuth();
  
  if (loading) return <div style={{ padding: '4rem', textAlign: 'center', fontWeight: 'bold' }}>Checking Griffith Session...</div>;
  
  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public Routes */}
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

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
