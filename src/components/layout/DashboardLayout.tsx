import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { AppSidebar } from './AppSidebar';
import { Loader2 } from 'lucide-react';
import { SlideshowHeader } from '@/components/SlideshowHeader';
import { ThemeToggle } from '@/components/ThemeToggle';
import { NotificationsDropdown } from '@/components/NotificationsDropdown';
import { SearchDropdown } from '@/components/SearchDropdown';
import { PendingAccess } from '@/components/PendingAccess';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { user, profile, loading, fetchProfile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth', { replace: true });
    }
  }, [user, loading, navigate]);

  // Force-refresh profile whenever the authenticated user changes
  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user?.id, fetchProfile]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Check if user has pending access (no branch assigned)
  if (profile && !profile.branch_id && profile.role === 'staff') {
    return <PendingAccess />;
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <header className="h-16 border-b border-border bg-background flex items-center justify-between px-4 md:px-6">
            <div className="flex items-center gap-2 md:gap-4 min-w-0">
              <SidebarTrigger />
              <SlideshowHeader />
            </div>
            
            <div className="flex items-center gap-2 md:gap-4">
              <div className="hidden lg:block">
                <SearchDropdown />
              </div>
              
              <ThemeToggle />
              <NotificationsDropdown />
            </div>
          </header>

          {/* Main Content */}
          <main className="flex-1 p-4 md:p-6 bg-background overflow-auto">
            <div className="max-w-7xl mx-auto">
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}