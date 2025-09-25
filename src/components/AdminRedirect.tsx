import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface AdminRedirectProps {
  children: React.ReactNode;
}

export function AdminRedirect({ children }: AdminRedirectProps) {
  const { profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect admin users directly to staff management page
    if (profile && (profile.role as string) === 'admin') {
      navigate('/staff', { replace: true });
    }
  }, [profile?.role, navigate]);

  // If user is admin, don't render the dashboard at all
  if (profile && (profile.role as string) === 'admin') {
    return null;
  }

  return <>{children}</>;
}