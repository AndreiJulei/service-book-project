import React from 'react';
import { Navigate } from 'react-router';
import { authService } from '../authService';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  if (!authService.isAuthenticated()) {
    return <Navigate to="/auth" replace />;
  }

  if (allowedRoles && allowedRoles.length > 0) {
    const user = authService.getCurrentUser();
    // Check if user has at least one of the allowed roles
    const hasAllowedRole = user?.roles?.some(role => allowedRoles.includes(role));
    if (!hasAllowedRole) {
      // Redirect to correct dashboard based on their role
      if (user?.roles?.includes('admin')) {
        return <Navigate to="/firm/dashboard" replace />;
      }
      if (user?.roles?.includes('user')) {
        return <Navigate to="/employee/schedule" replace />;
      }
      return <Navigate to="/client/search" replace />;
    }
  }

  return <>{children}</>;
};
