import { useAuth } from '@/hooks/useAuth';

interface AdminAuthProps {
  children: React.ReactNode;
}

export function AdminAuth({ children }: AdminAuthProps) {
  const { profile } = useAuth();

  // Check if user is admin
  if (profile && (profile.role as string) === 'admin') {
    return <>{children}</>;
  }

  // For non-admin users, return access denied message
  return (
    <div className="flex justify-center items-center h-64">
      <p className="text-muted-foreground">Access denied. Admin privileges required.</p>
    </div>
  );
}