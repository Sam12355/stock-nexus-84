import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarDays, User, Package, Truck, AlertCircle, CheckCircle, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface ActivityLog {
  id: string;
  action: string;
  user_name: string;
  item_name?: string;
  quantity?: number;
  timestamp: string;
  type: string;
  details: string;
}

interface ActivitySummary {
  todayActivities: number;
  stockMovements: number;
  alertsGenerated: number;
  activeUsers: number;
}

const ActivityLogs = () => {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [summary, setSummary] = useState<ActivitySummary>({
    todayActivities: 0,
    stockMovements: 0,
    alertsGenerated: 0,
    activeUsers: 0
  });
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>('all');

  const fetchActivityLogs = useCallback(async () => {
    if (!profile) return;
    setLoading(true);

    try {
      const branchId = profile.branch_id || profile.branch_context;
      
      // Get stock movements
      const { data: movementsData, error: movementsError } = await supabase
        .from('stock_movements')
        .select(`
          id,
          movement_type,
          quantity,
          created_at,
          reason,
          items (name, branch_id),
          profiles (name)
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (movementsError) throw movementsError;

      // Filter movements for current branch
      const branchMovements = (movementsData || []).filter(movement => 
        movement.items?.[0]?.branch_id === branchId
      );

      // Get activity logs
      const { data: activityData, error: activityError } = await supabase
        .from('activity_logs')
        .select('*')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(25);

      if (activityError) throw activityError;

      // Combine and format activities
      const formattedActivities: ActivityLog[] = [];

      // Add stock movements
      branchMovements.forEach(movement => {
        if (filterType === 'all' || filterType === 'stock') {
          formattedActivities.push({
            id: `movement-${movement.id}`,
            action: movement.movement_type === 'in' ? 'Stock In' : 'Stock Out',
            user_name: movement.profiles?.[0]?.name || 'Unknown User',
            item_name: movement.items?.[0]?.name || 'Unknown Item',
            quantity: movement.quantity,
            timestamp: movement.created_at,
            type: movement.movement_type === 'in' ? 'stock_in' : 'stock_out',
            details: movement.reason || `${movement.movement_type === 'in' ? 'Added' : 'Removed'} ${movement.quantity} units`
          });
        }
      });

      // Add activity logs
      (activityData || []).forEach(log => {
        if (filterType === 'all' || filterType === 'general') {
          formattedActivities.push({
            id: `log-${log.id}`,
            action: log.action,
            user_name: 'System', // Activity logs might not have user names
            timestamp: log.created_at,
            type: 'system',
            details: typeof log.details === 'object' 
              ? JSON.stringify(log.details) 
              : (log.details || log.action)
          });
        }
      });

      // Sort by timestamp and limit
      formattedActivities.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      setActivities(formattedActivities.slice(0, 50));

    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setLoading(false);
    }
  }, [profile, filterType]);

  const fetchActivitySummary = useCallback(async () => {
    if (!profile) return;

    try {
      const branchId = profile.branch_id || profile.branch_context;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayISO = today.toISOString();

      // Count today's stock movements
      const { count: movementsCount } = await supabase
        .from('stock_movements')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayISO);

      // Count today's activity logs
      const { count: activityCount } = await supabase
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .gte('created_at', todayISO);

      // Count alerts (notifications)
      const { count: alertsCount } = await supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .gte('created_at', todayISO);

      // Count active users (accessed today)
      const { count: activeUsersCount } = await supabase
        .from('profiles')
        .select('id', { count: 'exact', head: true })
        .eq('branch_id', branchId)
        .gte('last_access', todayISO);

      setSummary({
        todayActivities: (activityCount || 0) + (movementsCount || 0),
        stockMovements: movementsCount || 0,
        alertsGenerated: alertsCount || 0,
        activeUsers: activeUsersCount || 0
      });

    } catch (error) {
      console.error('Error fetching activity summary:', error);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      fetchActivityLogs();
      fetchActivitySummary();
    }
  }, [profile, fetchActivityLogs, fetchActivitySummary]);

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
      case "system":
        return <Activity className="h-4 w-4 text-purple-600" />;
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
      case "system":
        return "secondary";
      default:
        return "outline";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Activity Logs</h1>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Filter activities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Activities</SelectItem>
            <SelectItem value="stock">Stock Movements</SelectItem>
            <SelectItem value="general">General Logs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today's Activities</CardTitle>
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <div className="text-2xl font-bold">{summary.todayActivities}</div>
            )}
            <p className="text-xs text-muted-foreground">Total actions today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Movements</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <div className="text-2xl font-bold">{summary.stockMovements}</div>
            )}
            <p className="text-xs text-muted-foreground">In/Out operations today</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Alerts Generated</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <div className="text-2xl font-bold">{summary.alertsGenerated}</div>
            )}
            <p className="text-xs text-muted-foreground">Today's notifications</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <div className="text-2xl font-bold">{summary.activeUsers}</div>
            )}
            <p className="text-xs text-muted-foreground">Accessed today</p>
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
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-start space-x-4 rounded-lg border p-4">
                    <Skeleton className="h-4 w-4 rounded-full mt-1" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-5 w-20" />
                      </div>
                      <Skeleton className="h-3 w-full" />
                      <div className="flex items-center space-x-4">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-3 w-16" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : activities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No activities found
              </div>
            ) : (
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
                          {activity.user_name}
                        </span>
                        {activity.item_name && (
                          <span className="flex items-center">
                            <Package className="mr-1 h-3 w-3" />
                            {activity.item_name}
                          </span>
                        )}
                        {activity.quantity && (
                          <span>Qty: {activity.quantity}</span>
                        )}
                        <span className="flex items-center">
                          <CalendarDays className="mr-1 h-3 w-3" />
                          {formatTimestamp(activity.timestamp)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default ActivityLogs;