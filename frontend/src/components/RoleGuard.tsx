import React, { useEffect, useRef } from 'react'; // FIXED: A4
import { Navigate, useLocation } from 'react-router-dom'; // FIXED: A4
import { useAuthStore } from '../store/authStore'; // FIXED: A4
import { useToast } from './ToastProvider'; // FIXED: A4

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated } = useAuthStore(); // FIXED: A4
  const location = useLocation(); // FIXED: A4
  const { showToast } = useToast(); // FIXED: A4
  const toasted = useRef(false); // FIXED: A4

  const userRole = user?.role.toLowerCase().replace(/ /g, '_') || ''; // FIXED: A4
  const denied =
    !!(allowedRoles?.length && user) &&
    !allowedRoles!.some((role) => role.toLowerCase().replace(/ /g, '_') === userRole); // FIXED: A4

  useEffect(() => {
    if (denied && !toasted.current) {
      toasted.current = true; // FIXED: A4
      showToast('error', 'Access denied', 'Redirecting to your dashboard.'); // FIXED: A4
    }
  }, [denied, showToast]); // FIXED: A4

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />; // FIXED: A4
  }

  if (denied) {
    return <Navigate to="/dashboard" replace />; // FIXED: A4
  }

  return <>{children}</>; // FIXED: A4
};
