import React, { type ReactNode } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Sidebar, MobileMenuProvider, MobileHeader } from './Sidebar';
import { Navbar } from './Navbar';

interface LayoutProps {
  children: ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();

  // If authenticated, use sidebar layout
  if (isAuthenticated) {
    return (
      <MobileMenuProvider>
        <div className="h-screen bg-gray-50 relative overflow-hidden">
          {/* Mobile Header with hamburger */}
          <MobileHeader />

          {/* Sidebar (responsive) */}
          <Sidebar />

          {/* Main content with sidebar offset on desktop, full width on mobile */}
          <main className="lg:ml-64 h-screen overflow-y-auto pt-16 lg:pt-0">
            <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-6 w-full">
              {children}
            </div>
          </main>

          {/* Subtle decorative background */}
          <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/5 rounded-full mix-blend-multiply filter blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-400/5 rounded-full mix-blend-multiply filter blur-3xl"></div>
          </div>
        </div>
      </MobileMenuProvider>
    );
  }

  // If not authenticated, use top navbar layout (for login/register pages)
  return (
    <div className="min-h-screen relative">
      <Navbar />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-12">
        {children}
      </main>

      {/* Decorative background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-400/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-indigo-400/10 rounded-full mix-blend-multiply filter blur-3xl opacity-70"></div>
      </div>
    </div>
  );
};
