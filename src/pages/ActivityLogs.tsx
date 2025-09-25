import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CalendarDays, User, Package, Truck, AlertCircle, CheckCircle } from "lucide-react";

const ActivityLogs = () => {
  const { profile } = useAuth();

  // Mock activity data - this will be replaced with real data from Supabase
  const activities = [
    {
      id: 1,
      action: "Stock In",
      user: "John Doe",
      item: "Laptop Dell XPS",
      quantity: 5,
      timestamp: "2025-09-25 14:30",
      type: "stock_in",
      details: "Added 5 units to inventory"
    },
    {
      id: 2,
      action: "Stock Out",
      user: "Jane Smith",
      item: "iPhone 15",
      quantity: 2,
      timestamp: "2025-09-25 13:45",
      type: "stock_out",
      details: "Removed 2 units from inventory"
    },
    {
      id: 3,
      action: "Item Created",
      user: "Mike Johnson",
      item: "Samsung Monitor 27\"",
      quantity: 0,
      timestamp: "2025-09-25 12:20",
      type: "item_created",
      details: "New item added to catalog"
    },
    {
      id: 4,
      action: "Low Stock Alert",
      user: "System",
      item: "Wireless Mouse",
      quantity: 3,
      timestamp: "2025-09-25 11:15",
      type: "alert",
      details: "Stock level below threshold"
    },
    {
      id: 5,
      action: "User Login",
      user: "Sarah Wilson",
      item: "N/A",
      quantity: 0,
      timestamp: "2025-09-25 09:30",
      type: "user_action",
      details: "User logged into system"
    }
  ];

  const getIcon = (type: string) => {
    switch (type) {
      case "stock_in":
        return <Truck className="h-4 w-4 text-green-600" />;
      case "stock_out":
        return <Package className="h-4 w-4 text-orange-600" />;
      case "item_created":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case "alert":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "user_action":
        return <User className="h-4 w-4 text-purple-600" />;
      default:
        return <CalendarDays className="h-4 w-4 text-gray-600" />;
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case "stock_in":
        return "default";
      case "stock_out":
        return "secondary";
      case "item_created":
        return "outline";
      case "alert":
        return "destructive";
      case "user_action":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Activity Logs</h1>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Activities</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">42</div>
            <p className="text-xs text-muted-foreground">+8 from yesterday</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Movements</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">28</div>
            <p className="text-xs text-muted-foreground">In/Out operations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts Generated</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">6</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">8</div>
            <p className="text-xs text-muted-foreground">Currently online</p>
          </CardContent>
        </Card>
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 w-full">
            <div className="space-y-4">
              {activities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-4 rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    {getIcon(activity.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium leading-none">
                        {activity.action}
                      </p>
                      <Badge variant={getBadgeVariant(activity.type) as any}>
                        {activity.action}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {activity.details}
                    </p>
                    <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                      <span className="flex items-center">
                        <User className="mr-1 h-3 w-3" />
                        {activity.user}
                      </span>
                      {activity.item !== "N/A" && (
                        <span className="flex items-center">
                          <Package className="mr-1 h-3 w-3" />
                          {activity.item}
                        </span>
                      )}
                      {activity.quantity > 0 && (
                        <span>Qty: {activity.quantity}</span>
                      )}
                      <span className="flex items-center">
                        <CalendarDays className="mr-1 h-3 w-3" />
                        {activity.timestamp}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityLogs;