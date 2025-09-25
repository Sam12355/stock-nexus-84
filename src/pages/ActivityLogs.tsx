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


const ActivityLogs = () => {
  const { profile } = useAuth();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [filterType, setFilterType] = useState<string>('all');

  const fetchActivityLogs = useCallback(async () => {
    if (!profile) return;
    setLoadingFeed(activities.length === 0);

    try {
      const branchId = profile.branch_id || profile.branch_context;

      // Fetch movements (basic fields)
      const { data: movementsRaw, error: movementsError } = await supabase
        .from('stock_movements')
        .select('id, item_id, movement_type, quantity, created_at, updated_by, reason')
        .order('created_at', { ascending: false })
        .limit(200);
      if (movementsError) throw movementsError;
      const movements = movementsRaw || [];

      // Fetch items for this branch and map id -> name
      const itemIds = Array.from(new Set(movements.map(m => m.item_id)));
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select('id, name, branch_id')
        .eq('branch_id', branchId)
        .in('id', itemIds.length ? itemIds : ['00000000-0000-0000-0000-000000000000']);
      if (itemsError) throw itemsError;
      const itemMap = new Map<string, string>((itemsData || []).map(i => [i.id, i.name]));

      // Fetch profiles for updated_by users
      const userIds = Array.from(new Set(movements.map(m => m.updated_by).filter(Boolean)));
      let profileMap = new Map<string, string>();
      if (userIds.length) {
        const { data: profilesData, error: profilesError } = await supabase
          .from('profiles')
          .select('user_id, name')
          .in('user_id', userIds);
        if (profilesError) throw profilesError;
        profileMap = new Map<string, string>((profilesData || []).map(p => [p.user_id, p.name]));
      }

      // Build movement activities for this branch only
      const movementActivities: ActivityLog[] = movements
        .filter(m => itemMap.has(m.item_id))
        .map(movement => ({
          id: `movement-${movement.id}`,
          action: movement.movement_type === 'in' ? 'Stock received' : 'Stock dispensed',
          user_name: (movement.updated_by && profileMap.get(movement.updated_by)) || 'Unknown User',
          item_name: itemMap.get(movement.item_id) || 'Unknown Item',
          quantity: movement.quantity,
          timestamp: movement.created_at,
          type: movement.movement_type === 'in' ? 'stock_in' : 'stock_out',
          details: movement.reason || `${movement.movement_type === 'in' ? 'Added' : 'Removed'} ${movement.quantity} units of ${itemMap.get(movement.item_id) || 'Unknown Item'}`
        }));

      // Fetch general activity logs for this branch
      const { data: activityData, error: activityError } = await supabase
        .from('activity_logs')
        .select('id, action, created_at, details, user_id')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(50);
      if (activityError) {
        console.warn('activity_logs not accessible:', activityError);
      }

      // Map user names for activity logs
      let activityUserMap = profileMap;
      if (activityData && activityData.length) {
        const activityUserIds = Array.from(new Set(activityData.map(a => a.user_id).filter(Boolean)));
        const missing = activityUserIds.filter(id => !activityUserMap.has(id));
        if (missing.length) {
          const { data: moreProfiles } = await supabase
            .from('profiles')
            .select('user_id, name')
            .in('user_id', missing);
          if (moreProfiles) {
            moreProfiles.forEach(p => activityUserMap.set(p.user_id, p.name));
          }
        }
      }

      // Get all items for name resolution in general activities
      const { data: allItems } = await supabase
        .from('items')
        .select('id, name')
        .eq('branch_id', branchId);
      const allItemsMap = new Map<string, string>((allItems || []).map(i => [i.id, i.name]));

      const generalActivities: ActivityLog[] = (activityData || []).map(log => {
        const userName = (log.user_id && activityUserMap.get(log.user_id)) || 'System';
        let friendlyAction = log.action;
        let friendlyDetails = '';
        let activityType = 'system';

        // Parse details if it's JSON
        let parsedDetails: any = {};
        try {
          parsedDetails = typeof log.details === 'string' ? JSON.parse(log.details) : log.details || {};
        } catch {
          parsedDetails = {};
        }

        // Make activities user-friendly
        switch (log.action) {
          case 'login':
            friendlyAction = 'User logged in';
            friendlyDetails = `${userName} signed into the system`;
            activityType = 'login';
            break;
          case 'logout':
            friendlyAction = 'User logged out';
            friendlyDetails = `${userName} signed out of the system`;
            activityType = 'logout';
            break;
          case 'item_created':
            friendlyAction = 'Item added';
            friendlyDetails = `${userName} added a new item: ${parsedDetails.name || 'Unknown Item'}`;
            activityType = 'item_created';
            break;
          case 'item_updated':
            const itemName = allItemsMap.get(parsedDetails.item_id) || parsedDetails.name || 'Unknown Item';
            friendlyAction = 'Item updated';
            friendlyDetails = `${userName} updated item: ${itemName}`;
            activityType = 'item_updated';
            break;
          case 'item_deleted':
            const deletedItemName = allItemsMap.get(parsedDetails.item_id) || 'Unknown Item';
            friendlyAction = 'Item removed';
            friendlyDetails = `${userName} removed item: ${deletedItemName}`;
            activityType = 'item_deleted';
            break;
          case 'staff_created':
            friendlyAction = 'Staff member added';
            friendlyDetails = `${userName} added new staff member: ${parsedDetails.name || 'Unknown'}`;
            activityType = 'staff_created';
            break;
          case 'staff_updated':
            friendlyAction = 'Staff member updated';
            friendlyDetails = `${userName} updated staff member with role: ${parsedDetails.role || 'Unknown'}`;
            activityType = 'staff_updated';
            break;
          case 'staff_deleted':
            friendlyAction = 'Staff member removed';
            friendlyDetails = `${userName} removed a staff member`;
            activityType = 'staff_deleted';
            break;
          case 'profile_updated':
            friendlyAction = 'Profile updated';
            friendlyDetails = `${userName} updated their profile`;
            activityType = 'profile_updated';
            break;
          default:
            friendlyAction = log.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            friendlyDetails = typeof log.details === 'object' ? JSON.stringify(log.details) : (log.details || log.action);
        }

        return {
          id: `log-${log.id}`,
          action: friendlyAction,
          user_name: userName,
          timestamp: log.created_at,
          type: activityType,
          details: friendlyDetails
        };
      });

      // Store all activities and let filtering happen on frontend
      const allActivities = [...movementActivities, ...generalActivities];
      allActivities.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      setActivities(allActivities.slice(0, 100));

    } catch (error) {
      console.error('Error fetching activity logs:', error);
    } finally {
      setLoadingFeed(false);
      setInitialLoaded(true);
    }
  }, [profile]); // Remove filterType dependency for better performance

  // Filter activities on frontend for better performance
  const filteredActivities = activities.filter(activity => {
    if (filterType === 'all') return true;
    if (filterType === 'stock') return activity.type === 'stock_in' || activity.type === 'stock_out';
    if (filterType === 'general') return activity.type !== 'stock_in' && activity.type !== 'stock_out';
    return true;
  });

  useEffect(() => {
    if (profile) {
      fetchActivityLogs();
    }
  }, [profile, fetchActivityLogs]);

  const getIcon = (type: string) => {
    switch (type) {
      case "stock_in":
        return <Truck className="h-4 w-4 text-green-600" />;
      case "stock_out":
        return <Package className="h-4 w-4 text-orange-600" />;
      case "item_created":
        return <CheckCircle className="h-4 w-4 text-blue-600" />;
      case "item_updated":
        return <Activity className="h-4 w-4 text-blue-600" />;
      case "item_deleted":
        return <AlertCircle className="h-4 w-4 text-red-600" />;
      case "staff_created":
        return <User className="h-4 w-4 text-green-600" />;
      case "staff_updated":
        return <User className="h-4 w-4 text-blue-600" />;
      case "staff_deleted":
        return <User className="h-4 w-4 text-red-600" />;
      case "profile_updated":
        return <User className="h-4 w-4 text-purple-600" />;
      case "login":
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case "logout":
        return <AlertCircle className="h-4 w-4 text-gray-600" />;
      default:
        return <CalendarDays className="h-4 w-4 text-gray-600" />;
    }
  };

  const getBadgeVariant = (type: string) => {
    switch (type) {
      case "stock_in":
      case "item_created":
      case "staff_created":
      case "login":
        return "default";
      case "stock_out":
      case "item_updated":
      case "staff_updated":
      case "profile_updated":
        return "secondary";
      case "item_deleted":
      case "staff_deleted":
      case "logout":
        return "destructive";
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
          <SelectContent className="z-50">
            <SelectItem value="all">All Activities</SelectItem>
            <SelectItem value="stock">Stock Movements</SelectItem>
            <SelectItem value="general">General Logs</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-96 w-full">
            {(loadingFeed && !initialLoaded) ? (
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
            ) : filteredActivities.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No activities found
              </div>
            ) : (
              <div className="space-y-4">
                {filteredActivities.map((activity) => (
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