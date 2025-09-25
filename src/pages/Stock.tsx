import { useAuth } from "@/hooks/useAuth";

const Stock = () => {
  const { profile } = useAuth();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Stock Management</h1>
      </div>
      
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Current Stock</h3>
          <p className="text-muted-foreground">View and manage current stock levels.</p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Stock Movements</h3>
          <p className="text-muted-foreground">Track stock in and out movements.</p>
        </div>
        
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6">
          <h3 className="text-lg font-semibold mb-2">Low Stock Alerts</h3>
          <p className="text-muted-foreground">Monitor items with low stock levels.</p>
        </div>
      </div>
    </div>
  );
};

export default Stock;