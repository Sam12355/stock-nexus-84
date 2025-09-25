import { useAuth } from "@/hooks/useAuth";

const Settings = () => {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Branch Settings</h3>
          <p className="text-muted-foreground">Configure branch-specific settings.</p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Notifications</h3>
          <p className="text-muted-foreground">Manage notification preferences.</p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Profile</h3>
          <p className="text-muted-foreground">Update your profile information.</p>
        </div>
      </div>
    </div>
  );
};

export default Settings;