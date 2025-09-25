import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { DateTimePicker } from "@/components/DateTimePicker";
import { 
  Package, 
  Users, 
  TrendingUp, 
  AlertTriangle, 
  Activity,
  Calendar as CalendarIcon,
  Cloud,
  Thermometer,
  Droplets,
  Wind
} from "lucide-react";
import { Link } from "react-router-dom";
import { format } from "date-fns";

interface DashboardStats {
  totalItems: number;
  lowStockItems: number;
  criticalStockItems: number;
  totalStaff: number;
  recentActivities: ActivityLog[];
  lowStockDetails?: any[];
  criticalStockDetails?: any[];
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
    recentActivities: [],
    lowStockDetails: [],
    criticalStockDetails: []
  });
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [showStockModal, setShowStockModal] = useState(false);
  const [modalStockType, setModalStockType] = useState<'low' | 'critical'>('low');
  const [showEventModal, setShowEventModal] = useState(false);
  const [events, setEvents] = useState<any[]>([]);
  const [newEvent, setNewEvent] = useState({
    title: '',
    description: '',
    event_date: new Date() as Date | undefined,
    event_type: 'reminder'
  });
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | undefined>(new Date());
  const hasFetchedWeatherRef = useRef(false);

  const fetchDashboardData = async () => {
    try {
      // Fetch items and stock data
      const { data: stockData, error: stockError } = await supabase
        .from('stock')
        .select(`
          *,
          items (
            name,
            category,
            threshold_level,
            branch_id,
            image_url
          )
        `);

      if (stockError) throw stockError;

      // Filter by branch if not admin
      let filteredStock = stockData || [];
      if (profile?.role !== 'admin' && profile?.branch_id) {
        filteredStock = stockData?.filter(item => item.items.branch_id === profile.branch_id) || [];
      }

      // Calculate stock statistics - critical items are NOT included in low stock
      const totalItems = filteredStock.length;
      const criticalStock = filteredStock.filter(item => 
        item.current_quantity <= item.items.threshold_level * 0.5
      );
      const lowStock = filteredStock.filter(item => 
        item.current_quantity <= item.items.threshold_level && 
        item.current_quantity > item.items.threshold_level * 0.5
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

      // Fetch events
      let eventsQuery = supabase
        .from('calendar_events')
        .select('*')
        .gte('event_date', new Date().toISOString().split('T')[0])
        .order('event_date', { ascending: true })
        .limit(5);

      if (profile?.role !== 'admin' && profile?.branch_id) {
        eventsQuery = eventsQuery.eq('branch_id', profile.branch_id);
      }

      const { data: eventsData, error: eventsError } = await eventsQuery;
      if (eventsError) throw eventsError;

      setEvents(eventsData || []);

      setStats({
        totalItems,
        lowStockItems: lowStock.length,
        criticalStockItems: criticalStock.length,
        totalStaff: staffCount || 0,
        recentActivities: activities || [],
        lowStockDetails: lowStock,
        criticalStockDetails: criticalStock
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

  const handleAddEvent = async () => {
    if (!newEvent.title || !newEvent.event_date) return;

    try {
      // For admin users without branch_id, use a default branch or allow null
      const eventData = {
        title: newEvent.title,
        description: newEvent.description,
        event_date: format(newEvent.event_date, 'yyyy-MM-dd'),
        event_type: newEvent.event_type,
        branch_id: profile?.branch_id || null, // Allow null for admin users
        created_by: profile?.id
      };

      const { error } = await supabase
        .from('calendar_events')
        .insert([eventData]);

      if (error) throw error;

      // Refresh events
      fetchDashboardData();
      setShowEventModal(false);
      setNewEvent({
        title: '',
        description: '',
        event_date: new Date(),
        event_type: 'reminder'
      });
    } catch (error) {
      console.error('Error adding event:', error);
    }
  };

  useEffect(() => {
    if (profile) {
      fetchDashboardData();
      if (!hasFetchedWeatherRef.current) {
        hasFetchedWeatherRef.current = true;
        fetchWeatherData();
      }
    }
  }, [profile]);

  console.log('Index component render - showEventModal:', showEventModal, 'profile role:', profile?.role);

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
          {(profile?.role === 'admin' || profile?.role === 'manager') && (
            <Button size="sm" onClick={() => setShowEventModal(true)} className="ml-3">
              <CalendarIcon className="h-4 w-4 mr-1" /> Add Event
            </Button>
          )}
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

        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => {
            setModalStockType('low');
            setShowStockModal(true);
          }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Low Stock Items</CardTitle>
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">{stats.lowStockItems}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>

        <Card 
          className="cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => {
            setModalStockType('critical');
            setShowStockModal(true);
          }}
        >
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
        {/* Calendar & Events */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Calendar & Events</CardTitle>
              <CardDescription>Upcoming events and reminders</CardDescription>
            </div>
            {(profile?.role === 'admin' || profile?.role === 'manager') && (
              <Button onClick={() => {
                console.log('Add Event button clicked, current showEventModal:', showEventModal);
                setShowEventModal(true);
                console.log('setShowEventModal(true) called');
              }}>
                <CalendarIcon className="h-4 w-4 mr-2" />
                Add Event
              </Button>
            )}
          </CardHeader>
          <CardContent>
            <div className="grid lg:grid-cols-2 gap-6">
              {/* Calendar */}
              <div className="flex flex-col items-center">
                <Calendar
                  mode="single"
                  selected={selectedCalendarDate}
                  onSelect={setSelectedCalendarDate}
                  className="rounded-md border pointer-events-auto"
                />
              </div>
              
              {/* Events List */}
              <div className="space-y-4">
                <h4 className="font-semibold">Upcoming Events</h4>
                {events.length > 0 ? (
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {events.map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-3 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full bg-primary" />
                          <div>
                            <p className="font-medium">{event.title}</p>
                            <p className="text-sm text-muted-foreground">{event.description}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium">
                            {new Date(event.event_date).toLocaleDateString()}
                          </p>
                          <Badge variant="outline">{event.event_type}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    No upcoming events
                  </div>
                )}
              </div>
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

      {/* Stock Details Modal */}
      <Dialog open={showStockModal} onOpenChange={setShowStockModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {modalStockType === 'low' ? 'Low Stock Items' : 'Critical Stock Items'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {(modalStockType === 'low' ? stats.lowStockDetails : stats.criticalStockDetails)?.map((item: any) => (
              <div key={item.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {item.items.image_url ? (
                    <img 
                      src={item.items.image_url} 
                      alt={item.items.name}
                      className="w-10 h-10 rounded object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <p className="font-medium">{item.items.name}</p>
                    <p className="text-sm text-muted-foreground capitalize">{item.items.category}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">Current: {item.current_quantity}</p>
                  <p className="text-sm text-muted-foreground">Threshold: {item.items.threshold_level}</p>
                </div>
              </div>
            )) || []}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Event Modal */}
      <Dialog open={showEventModal} onOpenChange={(open) => {
        console.log('Dialog onOpenChange called with:', open);
        setShowEventModal(open);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Event</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="event-title">Title *</Label>
              <Input
                id="event-title"
                value={newEvent.title}
                onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                placeholder="Event title"
              />
            </div>
            <div>
              <Label htmlFor="event-description">Description</Label>
              <Input
                id="event-description"
                value={newEvent.description}
                onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
                placeholder="Event description"
              />
            </div>
            <div>
              <Label htmlFor="event-date">Date & Time *</Label>
              <DateTimePicker
                value={newEvent.event_date}
                onChange={(date) => setNewEvent({ ...newEvent, event_date: date })}
                placeholder="Select date and time"
              />
            </div>
            <div>
              <Label htmlFor="event-type">Type</Label>
              <Select onValueChange={(value) => setNewEvent({ ...newEvent, event_type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="reminder">Reminder</SelectItem>
                  <SelectItem value="delivery">Delivery</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setShowEventModal(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddEvent}>
                Add Event
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;