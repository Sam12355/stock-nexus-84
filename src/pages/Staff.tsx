import { useAuth } from "@/hooks/useAuth";

const Staff = () => {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Staff Management</h1>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Staff Members</h3>
          <p className="text-muted-foreground">Manage team members and their roles.</p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Permissions</h3>
          <p className="text-muted-foreground">Control user access and permissions.</p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Activity Log</h3>
          <p className="text-muted-foreground">Monitor staff activity and actions.</p>
        </div>
      </div>
    </div>
  );
};

export default Staff;