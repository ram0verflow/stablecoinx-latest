import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useAuthStore } from '../store/authStore';

export const Layout: React.FC = () => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-brand-primary/30 selection:text-white">
      {/* Dynamic Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-brand-primary/5 blur-[120px]" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-brand-secondary/5 blur-[120px]" />
          <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-violet-500/5 blur-[100px]" />
      </div>

      <Sidebar />
      
      <div className="ml-64 flex flex-col min-h-screen relative">
        <Navbar />
        <main className="flex-1 p-8 animate-fade-in relative z-20">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
