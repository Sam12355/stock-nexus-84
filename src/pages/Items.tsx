import { useAuth } from "@/hooks/useAuth";

const Items = () => {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Items</h1>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Manage Items</h3>
          <p className="text-muted-foreground">Add, edit, and organize your inventory items.</p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Categories</h3>
          <p className="text-muted-foreground">Organize items by categories and types.</p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Item Details</h3>
          <p className="text-muted-foreground">View detailed information about each item.</p>
        </div>
      </div>
    </div>
  );
};

export default Items;