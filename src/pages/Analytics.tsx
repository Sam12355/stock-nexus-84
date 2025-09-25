import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, LineChart, PieChart, TrendingUp, Package, Users, AlertTriangle, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart as RechartsBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RechartsPieChart, Cell, Pie, LineChart as RechartsLineChart, Line } from "recharts";
import { Skeleton } from "@/components/ui/skeleton";

interface AnalyticsData {
  totalItems: number;
  lowStockItems: number;
  activeUsers: number;
  stockMovements: number;
  categoryData: Array<{ name: string; value: number; color: string }>;
  movementTrends: Array<{ date: string; in: number; out: number }>;
  topItems: Array<{ name: string; movements: number }>;
}

const Analytics = () => {
  const { profile } = useAuth();
  const [analytics, setAnalytics] = useState<AnalyticsData>({
    totalItems: 0,
    lowStockItems: 0,
    activeUsers: 0,
    stockMovements: 0,
    categoryData: [],
    movementTrends: [],
    topItems: []
  });
  const [loading, setLoading] = useState(true);

  const fetchAnalyticsData = useCallback(async () => {
    if (!profile) return;
    setLoading(analytics.totalItems === 0 && analytics.categoryData.length === 0 && analytics.movementTrends.length === 0);

    try {
      const branchId = profile.branch_id || profile.branch_context;

      // Fetch total items and stock data
      const { data: itemsData, error: itemsError } = await supabase
        .from('items')
        .select(`
          id,
          name,
          category,
          threshold_level,
          stock (current_quantity)
        `)
        .eq('branch_id', branchId);

      if (itemsError) throw itemsError;

      const totalItems = itemsData?.length || 0;
      const lowStockItems = itemsData?.filter(item => {
        const currentQty = item.stock?.[0]?.current_quantity || 0;
        return currentQty <= item.threshold_level;
      }).length || 0;

      // Category distribution
      const categoryCount: { [key: string]: number } = {};
      itemsData?.forEach(item => {
        categoryCount[item.category] = (categoryCount[item.category] || 0) + 1;
      });

      const colors = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
      const formatCategory = (raw: string) => raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
      const categoryData = Object.entries(categoryCount).map(([name, value], index) => ({
        name: formatCategory(name),
        value,
        color: colors[index % colors.length]
      }));

      // Fetch stock movements for last 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const { data: movementsData, error: movementsError } = await supabase
        .from('stock_movements')
        .select(`
          id,
          movement_type,
          quantity,
          created_at,
          items!inner (name, branch_id)
        `)
        .eq('items.branch_id', branchId)
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (movementsError) throw movementsError;

      // Movements for current branch (already filtered via join)
      const branchMovements = (movementsData || []);

      const totalMovements = branchMovements.length;

      // Movement trends by day (last 7 days, zero-filled)
      const movementsByDate: { [key: string]: { in: number; out: number } } = {};
      branchMovements.forEach(movement => {
        const date = new Date(movement.created_at).toLocaleDateString();
        if (!movementsByDate[date]) {
          movementsByDate[date] = { in: 0, out: 0 };
        }
        movementsByDate[date][movement.movement_type as 'in' | 'out'] += movement.quantity;
      });

      const movementTrends = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const key = d.toLocaleDateString();
        const val = movementsByDate[key] || { in: 0, out: 0 };
        return { date: key, ...val };
      });

      // Top performing items
      const itemMovementCount: { [key: string]: number } = {};
      branchMovements.forEach(movement => {
        const itemName = movement.items?.[0]?.name;
        if (itemName) {
          itemMovementCount[itemName] = (itemMovementCount[itemName] || 0) + 1;
        }
      });

      const topItems = Object.entries(itemMovementCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([name, movements]) => ({ name, movements }));

      // Fetch active users (profiles with recent activity)
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, last_access')
        .eq('branch_id', branchId);

      if (usersError) throw usersError;

      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

      const activeUsers = usersData?.filter(user => 
        user.last_access && new Date(user.last_access) > oneWeekAgo
      ).length || 0;

      setAnalytics({
        totalItems,
        lowStockItems,
        activeUsers,
        stockMovements: totalMovements,
        categoryData,
        movementTrends,
        topItems
      });

    } catch (error) {
      console.error('Error fetching analytics data:', error);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    if (profile) {
      fetchAnalyticsData();
    }
  }, [profile, fetchAnalyticsData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h1>
      </div>
      
      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <div className="text-2xl font-bold">{analytics.totalItems}</div>
            )}
            <p className="text-xs text-muted-foreground">Items in inventory</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <div className="text-2xl font-bold">{analytics.lowStockItems}</div>
            )}
            <p className="text-xs text-muted-foreground">Below threshold</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <div className="text-2xl font-bold">{analytics.activeUsers}</div>
            )}
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stock Movements</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-16 mb-1" />
            ) : (
              <div className="text-2xl font-bold">{analytics.stockMovements}</div>
            )}
            <p className="text-xs text-muted-foreground">Last 7 days</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-5 w-5" />
              Category Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Skeleton className="h-32 w-32 rounded-full" />
                </div>
              ) : analytics.categoryData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      dataKey="value"
                      data={analytics.categoryData}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {analytics.categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </RechartsPieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {loading ? "Loading..." : "No data available"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LineChart className="h-5 w-5" />
              Movement Trends (Last 7 Days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              {loading ? (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-4 w-2/3" />
                </div>
              ) : analytics.movementTrends.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsLineChart data={analytics.movementTrends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="in" stroke="#10b981" name="Stock In" />
                    <Line type="monotone" dataKey="out" stroke="#ef4444" name="Stock Out" />
                  </RechartsLineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  {loading ? "Loading..." : "No movement data available"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Additional Analytics */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top Active Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.topItems.length > 0 ? (
                analytics.topItems.map((item, index) => (
                  <div key={index} className="flex justify-between">
                    <span className="text-sm">{item.name}</span>
                    <span className="text-sm font-medium">{item.movements} moves</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">
                  {loading ? "Loading..." : "No movement data available"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Category Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {analytics.categoryData.length > 0 ? (
                analytics.categoryData.map((category, index) => (
                  <div key={index} className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full" 
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-sm">{category.name}</span>
                    </div>
                    <span className="text-sm font-medium">{category.value} items</span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-muted-foreground">
                  {loading ? "Loading..." : "No category data available"}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Analytics;