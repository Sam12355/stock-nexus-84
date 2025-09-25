import { useState, useEffect } from 'react';
import { Bell, AlertTriangle, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Notification {
  id: string;
  type: string;
  message: string;
  created_at: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  event_date: string;
  event_type: string;
}

interface StockAlert {
  id: string;
  name: string;
  current_quantity: number;
  threshold_level: number;
}

export function NotificationsDropdown() {
  const { profile } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    if (profile) {
      fetchNotifications();
      fetchUpcomingEvents();
      fetchStockAlerts();
    }
  }, [profile]);

  const fetchNotifications = async () => {
    if (!profile) return;

    try {
      const branchId = profile.branch_id || profile.branch_context;
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('branch_id', branchId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (error) throw error;
      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const fetchUpcomingEvents = async () => {
    if (!profile) return;

    try {
      const branchId = profile.branch_id || profile.branch_context;
      const today = new Date().toISOString().split('T')[0];
      const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('branch_id', branchId)
        .gte('event_date', today)
        .lte('event_date', weekFromNow)
        .order('event_date', { ascending: true })
        .limit(5);

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    }
  };

  const fetchStockAlerts = async () => {
    if (!profile) return;

    try {
      const branchId = profile.branch_id || profile.branch_context;
      
      const { data, error } = await supabase
        .from('items')
        .select(`
          id,
          name,
          threshold_level,
          stock!inner (
            current_quantity
          )
        `)
        .eq('branch_id', branchId)
        .limit(5);

      if (error) throw error;
      
      const alerts = (data || [])
        .filter(item => item.stock?.[0]?.current_quantity <= item.threshold_level)
        .map(item => ({
          id: item.id,
          name: item.name,
          current_quantity: item.stock?.[0]?.current_quantity || 0,
          threshold_level: item.threshold_level
        }));
      
      setStockAlerts(alerts);
    } catch (error) {
      console.error('Error fetching stock alerts:', error);
    }
  };

  useEffect(() => {
    setTotalCount(notifications.length + events.length + stockAlerts.length);
  }, [notifications, events, stockAlerts]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {totalCount > 0 && (
            <span className="absolute -top-1 -right-1 h-3 w-3 bg-destructive rounded-full text-[10px] text-destructive-foreground flex items-center justify-center">
              {totalCount > 9 ? '9+' : totalCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80" align="end">
        <DropdownMenuLabel>Notifications</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        <ScrollArea className="h-96">
          {/* Stock Alerts */}
          {stockAlerts.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1">
                Stock Alerts
              </DropdownMenuLabel>
              {stockAlerts.map((alert) => (
                <DropdownMenuItem key={alert.id} className="flex items-start space-x-2 p-3">
                  <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{alert.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Stock: {alert.current_quantity}/{alert.threshold_level}
                    </p>
                    <Badge variant="outline" className="text-xs">Low Stock</Badge>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}

          {/* Upcoming Events */}
          {events.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1">
                Upcoming Events
              </DropdownMenuLabel>
              {events.map((event) => (
                <DropdownMenuItem key={event.id} className="flex items-start space-x-2 p-3">
                  <Calendar className="h-4 w-4 text-blue-500 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium">{event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(event.event_date)}
                    </p>
                    <Badge variant="secondary" className="text-xs capitalize">
                      {event.event_type.replace('_', ' ')}
                    </Badge>
                  </div>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}

          {/* General Notifications */}
          {notifications.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs font-semibold text-muted-foreground px-2 py-1">
                General Notifications
              </DropdownMenuLabel>
              {notifications.map((notification) => (
                <DropdownMenuItem key={notification.id} className="flex items-start space-x-2 p-3">
                  <Clock className="h-4 w-4 text-gray-500 mt-0.5" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm">{notification.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(notification.created_at)}
                    </p>
                  </div>
                </DropdownMenuItem>
              ))}
            </>
          )}

          {totalCount === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No new notifications
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}