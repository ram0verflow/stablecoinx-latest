import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout, BareLayout } from './components/Layout';
import { ToastProvider } from './components/ToastProvider';
import { AuthGuard } from './components/AuthGuard';
import { RoleGuard } from './components/RoleGuard';
import { Login } from './pages/Login';
import { Landing } from './pages/Landing';
import { Overview } from './pages/Overview';
import { Payments } from './pages/Payments';
import { CreatePayment } from './pages/CreatePayment';
import { RouteAnalysis } from './pages/RouteAnalysis';
import { ApprovalQueue } from './pages/ApprovalQueue';
import { Policies } from './pages/Policies';
import { Compliance } from './pages/Compliance';
import { ObfuscationIntelligence } from './pages/ObfuscationIntelligence';
import { MixerSignalExplorer } from './pages/MixerSignalExplorer';
import { AuditReports } from './pages/AuditReports';
import { Revalidation } from './pages/Revalidation';
import { Integrations } from './pages/Integrations';
import { Infrastructure } from './pages/Infrastructure';
import { Settings } from './pages/Settings';
import { ProofPage } from './pages/ProofPage';
import { useAuthStore } from './store/authStore';
import { supabase } from './lib/supabase';
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
    <ErrorBoundary>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<Login />} />
            <Route path="/proof/:paymentId" element={<ProofPage />} />

            <Route
              element={
                <AuthGuard>
                  <Layout />
                </AuthGuard>
              }
            >
              <Route path="dashboard" element={<Overview />} />
              <Route path="payments" element={<Payments />} />
              <Route
                path="approval-queue"
                element={
                  <RoleGuard allowedRoles={['treasury_officer', 'reviewer', 'admin']}>
                    <ApprovalQueue />
                  </RoleGuard>
                }
              />
              <Route path="policies" element={<Policies />} />
              <Route path="compliance" element={<Compliance />} />
              <Route path="obfuscation-intelligence" element={<ObfuscationIntelligence />} />
              <Route path="mixer-signals" element={<MixerSignalExplorer />} />
              <Route
                path="audit-reports"
                element={
                  <RoleGuard allowedRoles={['auditor', 'admin', 'compliance_officer']}>
                    <AuditReports />
                  </RoleGuard>
                }
              />
              <Route
                path="revalidation"
                element={
                  <RoleGuard allowedRoles={['compliance_officer', 'admin', 'auditor']}>
                    <Revalidation />
                  </RoleGuard>
                }
              />
              <Route path="integrations" element={<Integrations />} />
              <Route path="infrastructure" element={<Infrastructure />} />
              <Route path="settings" element={<Settings />} />
            </Route>

            <Route
              element={
                <AuthGuard>
                  <BareLayout />
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
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
};

export default App;
