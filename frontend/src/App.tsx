import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/ToastProvider';
import { AuthGuard } from './components/AuthGuard';
import { RoleGuard } from './components/RoleGuard';
import { Login } from './pages/Login';
import { Landing } from './pages/Landing';
import { Dashboard } from './pages/Dashboard';
import { CreatePayment } from './pages/CreatePayment';
import { RouteAnalysis } from './pages/RouteAnalysis';
import { ApprovalQueue } from './pages/ApprovalQueue';
import { AuditReports } from './pages/AuditReports';
import { Alerts } from './pages/Alerts';
import { Revalidation } from './pages/Revalidation';
import { Settings } from './pages/Settings';
import { useAuthStore } from './store/authStore';
import { supabase } from './lib/supabase';
import { Loader2 } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';

export const App: React.FC = () => {
  const restoreSession = useAuthStore(state => state.restoreSession);
  const logout = useAuthStore(state => state.logout);

  useEffect(() => {
    // Restore session silently in the background
    restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') logout();
    });

    return () => subscription.unsubscribe();
  }, [restoreSession, logout]);

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />

          <Route
            path="/dashboard"
            element={
              <AuthGuard>
                <Layout />
              </AuthGuard>
            }
          >
            <Route index element={<DashboardRedirect />} />
            <Route
              path="admin"
              element={
                <RoleGuard allowedRoles={['admin']}>
                  <Dashboard />
                </RoleGuard>
              }
            />
            <Route
              path="treasury"
              element={
                <RoleGuard allowedRoles={['treasury_officer']}>
                  <Dashboard />
                </RoleGuard>
              }
            />
            <Route
              path="compliance"
              element={
                <RoleGuard allowedRoles={['compliance_officer']}>
                  <Dashboard />
                </RoleGuard>
              }
            />
            <Route
              path="reviewer"
              element={
                <RoleGuard allowedRoles={['reviewer']}>
                  <Dashboard />
                </RoleGuard>
              }
            />
            <Route
              path="auditor"
              element={
                <RoleGuard allowedRoles={['auditor']}>
                  <Dashboard />
                </RoleGuard>
              }
            />
          </Route>

          <Route
            element={
              <AuthGuard>
                <Layout />
              </AuthGuard>
            }
          >
            <Route
              path="create-payment"
              element={
                <RoleGuard allowedRoles={['treasury_officer', 'admin']}>
                  <CreatePayment />
                </RoleGuard>
              }
            />
            <Route path="route-analysis/:paymentId" element={<RouteAnalysis />} />
            <Route
              path="approval-queue"
              element={
                <RoleGuard allowedRoles={['treasury_officer', 'reviewer', 'admin']}>
                  <ApprovalQueue />
                </RoleGuard>
              }
            />
            <Route
              path="audit-reports"
              element={
                <RoleGuard allowedRoles={['auditor', 'admin', 'compliance_officer']}>
                  <AuditReports />
                </RoleGuard>
              }
            />
            <Route path="alerts" element={<Alerts />} />
            <Route
              path="revalidation"
              element={
                <RoleGuard allowedRoles={['compliance_officer', 'admin', 'auditor']}>
                  <Revalidation />
                </RoleGuard>
              }
            />
            <Route path="settings" element={<Settings />} />
          </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
};

function dashboardSegmentForRole(role: string): string {
  switch (role) {
    case 'admin': return 'admin';
    case 'treasury_officer': return 'treasury';
    case 'compliance_officer': return 'compliance';
    case 'reviewer': return 'reviewer';
    case 'auditor': return 'auditor';
    default: return 'viewer';
  }
}

const DashboardRedirect = () => {
  const { user, role } = useAuthStore();
  if (!user || !role) return <Navigate to="/login" replace />;
  const segment = dashboardSegmentForRole(role);
  return <Navigate to={`/dashboard/${segment}`} replace />;
};

export default App;
