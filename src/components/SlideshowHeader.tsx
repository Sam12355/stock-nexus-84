import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Thermometer, CalendarDays, MapPin, Droplets, Wind } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Event {
  id: string;
  title: string;
  event_date: string;
}

interface WeatherData {
  temperature: number;
  condition: string;
  location: string;
  humidity: number;
  windSpeed: number;
}

interface Slide {
  type: 'event' | 'datetime' | 'weather';
  id: string;
  content: React.ReactNode;
}

export function SlideshowHeader() {
  const { profile } = useAuth();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [events, setEvents] = useState<Event[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [branchLocation, setBranchLocation] = useState<string>('');

  // Only show slideshow for management roles
  const showSlideshow = profile && ['regional_manager', 'district_manager', 'manager', 'assistant_manager'].includes(profile.role as string);

  // Fetch branch location and events
  useEffect(() => {
    if (!showSlideshow) return;
    
    const fetchBranchData = async () => {
      try {
        const { data: user } = await supabase.auth.getUser();
        if (!user?.user?.id) return;

        const { data: profileData } = await supabase
          .from('profiles')
          .select('branch_context, branch_id, role')
          .eq('user_id', user.user.id)
          .single();

        if (!profileData) return;

        // Use branch_context for regional/district managers, branch_id for others
        const branchId = profileData.branch_context || profileData.branch_id;
        if (!branchId) return;

        const { data: branch } = await supabase
          .from('branches')
          .select('location')
          .eq('id', branchId)
          .single();
        
        if (branch?.location) {
          setBranchLocation(branch.location);
        }

        const { data: events } = await supabase
          .from('calendar_events')
          .select('id, title, event_date')
          .eq('branch_id', branchId)
          .gte('event_date', new Date().toISOString())
          .order('event_date', { ascending: true })
          .limit(5);
        
        if (events) setEvents(events);
      } catch (error) {
        console.error('Error fetching branch data:', error);
      }
    };
    fetchBranchData();
  }, [showSlideshow]);

  // Fetch weather based on branch location
  useEffect(() => {
    const fetchWeather = async () => {
      if (!branchLocation) return;
      
      try {
        const { data, error } = await supabase.functions.invoke('get-weather', {
          body: { city: branchLocation }
        });
        
        if (error) throw error;
        
        if (data) {
          setWeather({
            temperature: Math.round(data.temperature),
            condition: data.description,
            location: branchLocation,
            humidity: data.humidity,
            windSpeed: Math.round(data.windSpeed * 3.6) // Convert m/s to km/h
          });
        }
      } catch (error) {
        // Fallback weather data
        setWeather({ 
          temperature: 24, 
          condition: 'Partly Cloudy', 
          location: branchLocation || 'Colombo',
          humidity: 65,
          windSpeed: 12
        });
      }
    };
    
    if (branchLocation) {
      fetchWeather();
    }
  }, [branchLocation]);

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Create slides array
  const slides: Slide[] = [
    ...events.map((event, index) => ({
      type: 'event' as const,
      id: `event-${index}`,
      content: (
        <div className="flex items-center gap-2 text-sm">
          <CalendarDays className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">{event.title}</span>
          <span className="text-muted-foreground">
            {new Date(event.event_date).toLocaleDateString()}
          </span>
        </div>
      )
    })),
    {
      type: 'datetime' as const,
      id: 'datetime',
      content: (
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-4 w-4" />
            <span>{currentTime.toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            })}</span>
          </div>
          <div className="flex items-center gap-1 text-foreground font-medium">
            <Clock className="h-4 w-4" />
            <span>{currentTime.toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              hour12: false
            })}</span>
          </div>
        </div>
      )
    }
  ];

  if (weather) {
    slides.push({
      type: 'weather' as const,
      id: 'weather',
      content: (
        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-1">
            <Thermometer className="h-4 w-4 text-orange-500" />
            <span className="font-medium text-foreground">{weather.temperature}°C</span>
          </div>
          <div className="flex items-center gap-1">
            <Droplets className="h-4 w-4 text-blue-500" />
            <span className="text-muted-foreground">{weather.humidity}%</span>
          </div>
          <div className="flex items-center gap-1">
            <Wind className="h-4 w-4 text-green-500" />
            <span className="text-muted-foreground">{weather.windSpeed}km/h</span>
          </div>
          <div className="flex items-center gap-1 text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="text-xs">{weather.location}</span>
          </div>
        </div>
      )
    });
  }

  // Auto-advance slides
  useEffect(() => {
    if (slides.length === 0) return;
    
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 3000); // Change slide every 3 seconds

    return () => clearInterval(timer);
  }, [slides.length]);

  // Don't show slideshow for non-management roles
  if (!showSlideshow) {
    return null;
  }

  if (slides.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <Clock className="h-4 w-4" />
        <span>Loading...</span>
      </div>
    );
  }

  return (
    <div className="relative h-6 overflow-hidden">
      <div 
        className="flex flex-col transition-transform duration-500 ease-in-out"
        style={{
          transform: `translateY(-${currentSlide * 24}px)`
        }}
      >
        {slides.map((slide, index) => (
          <div
            key={`${slide.id}-${index}`}
            className="h-6 flex items-center animate-fade-in"
          >
            {slide.content}
          </div>
        ))}
      </div>
    </div>
  );
}