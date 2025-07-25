// components/ProtectedRoute.js
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export const ProtectedRoute = ({ 
  children, 
  roles = [], 
  permissions = [],
  requireOrganization = false 
}) => {
  const { user, loading } = useAuth();
  const location = useLocation();
  
  if (loading) {
    return <div>Loading...</div>;
  }
  
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  
  if (roles.length > 0 && !roles.includes(user.role)) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  if (permissions.length > 0 && !permissions.some(p => user.permissions?.includes(p))) {
    return <Navigate to="/unauthorized" replace />;
  }
  
  if (requireOrganization && !user.organizationId) {
    return <Navigate to="/organization/select" replace />;
  }
  
  return children;
};

// 使用示例
<ProtectedRoute roles={['doctor', 'nurse']} permissions={['view_patients']}>
  <PatientList />
</ProtectedRoute>