import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Package, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Activity,
  Calendar,
  Cloud,
  Thermometer,
  Droplets,
  Wind
} from "lucide-react";
import { Link } from "react-router-dom";

interface DashboardStats {
  totalItems: number;
  lowStockItems: number;
  criticalStockItems: number;
  totalStaff: number;
  recentActivities: ActivityLog[];
}

interface ActivityLog {
  id: string;
  action: string;
  details: any;
  created_at: string;
  user_id?: string;
  profiles?: {
    name: string;
  };
}

interface WeatherData {
  temperature: number;
  description: string;
  icon: string;
  humidity: number;
  windSpeed: number;
  city: string;
  country: string;
}

const Index = () => {
  const { profile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    lowStockItems: 0,
    criticalStockItems: 0,
    totalStaff: 0,
    recentActivities: []
  });
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(true);

  const fetchDashboardData = async () => {
    try {
      // Fetch items and stock data
      const { data: stockData, error: stockError } = await supabase
        .from('stock')
        .select(`
          *,
          items (
            name,
            threshold_level,
            branch_id
          )
        `);

      if (stockError) throw stockError;

      // Filter by branch if not admin
      let filteredStock = stockData || [];
      if (profile?.role !== 'admin' && profile?.branch_id) {
        filteredStock = stockData?.filter(item => item.items.branch_id === profile.branch_id) || [];
      }

      // Calculate stock statistics
      const totalItems = filteredStock.length;
      const lowStock = filteredStock.filter(item => 
        item.current_quantity <= item.items.threshold_level
      );
      const criticalStock = filteredStock.filter(item => 
        item.current_quantity <= item.items.threshold_level * 0.5
      );

      // Fetch staff count
      let staffQuery = supabase.from('profiles').select('*', { count: 'exact' });
      if (profile?.role !== 'admin' && profile?.branch_id) {
        staffQuery = staffQuery.eq('branch_id', profile.branch_id);
      }
      
      const { count: staffCount, error: staffError } = await staffQuery;
      if (staffError) throw staffError;

      // Fetch recent activities
      let activityQuery = supabase
        .from('activity_logs')
        .select(`
          *,
          profiles (
            name
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (profile?.role !== 'admin' && profile?.branch_id) {
        activityQuery = activityQuery.eq('branch_id', profile.branch_id);
      }

      const { data: activities, error: activityError } = await activityQuery;
      if (activityError) throw activityError;

      setStats({
        totalItems,
        lowStockItems: lowStock.length,
        criticalStockItems: criticalStock.length,
        totalStaff: staffCount || 0,
        recentActivities: activities || []
      });

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeatherData = async () => {
    try {
      // Get branch location - for now using Vaxjo as default
      const city = "Vaxjo"; // Can be made dynamic based on branch
      
      const { data, error } = await supabase.functions.invoke('get-weather', {
        body: { city }
      });

      if (error) throw error;
      setWeather(data);
    } catch (error) {
      console.error('Error fetching weather:', error);
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchDashboardData();
      fetchWeatherData();
    }
  }, [profile]);

  if (!profile) {
    return <div className="flex justify-center items-center h-64">Please log in to access the dashboard.</div>;
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading dashboard...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back, {profile?.name || 'User'}! Here's what's happening with your inventory.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Activity className="h-4 w-4" />
          Today: {new Date().toLocaleDateString()}
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Items</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalItems}</div>
            <p className="text-xs text-muted-foreground">Items in inventory</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.lowStockItems}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Critical Stock</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{stats.criticalStockItems}</div>
            <p className="text-xs text-muted-foreground">Urgent attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Staff Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalStaff}</div>
            <p className="text-xs text-muted-foreground">Active users</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recent Activity */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest system activities and updates</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.recentActivities.length > 0 ? (
                stats.recentActivities.map((activity) => (
                  <div key={activity.id} className="flex items-center justify-between p-3 rounded-lg border">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <div>
                        <p className="font-medium">{activity.action}</p>
                        <p className="text-sm text-muted-foreground">
                          {activity.profiles?.name || 'System'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {new Date(activity.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  No recent activities found
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions & Weather */}
        <div className="space-y-6">
          {/* Weather Widget */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cloud className="h-5 w-5" />
                Weather in Vaxjo
              </CardTitle>
            </CardHeader>
            <CardContent>
              {weatherLoading ? (
                <div className="text-center py-4">
                  <div className="text-sm text-muted-foreground">Loading weather...</div>
                </div>
              ) : weather ? (
                <div className="space-y-3">
                  <div className="text-center">
                    <div className="text-3xl font-bold">{weather.temperature}°C</div>
                    <p className="text-sm text-muted-foreground capitalize">{weather.description}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-blue-500" />
                      <span className="text-sm">{weather.humidity}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wind className="h-4 w-4 text-gray-500" />
                      <span className="text-sm">{weather.windSpeed} m/s</span>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-2">
                    Good conditions for deliveries
                  </p>
                </div>
              ) : (
                <div className="text-center py-4">
                  <div className="text-sm text-muted-foreground">Weather unavailable</div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Link to="/items">
                  <Button variant="outline" className="w-full justify-start">
                    <Package className="h-4 w-4 mr-2" />
                    Manage Items
                  </Button>
                </Link>
                <Link to="/stock">
                  <Button variant="outline" className="w-full justify-start">
                    <TrendingUp className="h-4 w-4 mr-2" />
                    Stock Movement
                  </Button>
                </Link>
                <Link to="/staff">
                  <Button variant="outline" className="w-full justify-start">
                    <Users className="h-4 w-4 mr-2" />
                    Manage Staff
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Index;