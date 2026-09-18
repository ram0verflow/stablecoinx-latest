import React from 'react'; // FIXED: A4
import { Navigate } from 'react-router-dom'; // FIXED: A4
import { useAuthStore } from '../store/authStore'; // FIXED: A4

export const AuthGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated); // FIXED: A4
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />; // FIXED: A4
  }
  return <>{children}</>; // FIXED: A4
};
