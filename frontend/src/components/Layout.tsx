import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Rail } from './scx/Rail';
import { useAuthStore } from '../store/authStore';

/** Shell layout for list-style pages — sidebar rail + main content column. */
export const Layout: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="scx shell">
      <Rail />
      <div className="main">
        <Outlet />
      </div>
    </div>
  );
};

/** Bare authenticated wrapper for full-bleed pages that render their own chrome
 * (Create Payment, Payment Control Room) — matches the reference design, which
 * has no sidebar on these pages. */
export const BareLayout: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="scx" style={{ minHeight: '100vh', background: 'var(--canvas)' }}>
      <Outlet />
    </div>
  );
};
