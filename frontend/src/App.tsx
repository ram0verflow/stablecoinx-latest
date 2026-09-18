import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { ToastProvider } from './components/ToastProvider';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { CreatePayment } from './pages/CreatePayment';
import { RouteAnalysis } from './pages/RouteAnalysis';
import { ApprovalQueue } from './pages/ApprovalQueue';
import { AuditReports } from './pages/AuditReports';
import { Alerts } from './pages/Alerts';
import { Revalidation } from './pages/Revalidation';
import { Settings } from './pages/Settings';

export const App: React.FC = () => {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<Layout />}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="create-payment" element={<CreatePayment />} />
            <Route path="route-analysis/:paymentId" element={<RouteAnalysis />} />
            <Route path="approval-queue" element={<ApprovalQueue />} />
            <Route path="audit-reports" element={<AuditReports />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="revalidation" element={<Revalidation />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
};

export default App;
