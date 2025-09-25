import React, { useState, useEffect } from 'react';
import { Calendar, Clock, Thermometer, CalendarDays, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface Event {
  id: string;
  title: string;
  event_date: string;
}

interface WeatherData {
  temperature: number;
  condition: string;
  location: string;
}

interface Slide {
  type: 'event' | 'datetime' | 'weather';
  id: string;
  content: React.ReactNode;
}

export function SlideshowHeader() {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [events, setEvents] = useState<Event[]>([]);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Fetch events
  useEffect(() => {
    const fetchEvents = async () => {
      const { data } = await supabase
        .from('calendar_events')
        .select('id, title, event_date')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true })
        .limit(5);
      
      if (data) setEvents(data);
    };
    fetchEvents();
  }, []);

  // Fetch weather
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const response = await fetch('/api/weather');
        if (response.ok) {
          const data = await response.json();
          setWeather(data);
        } else {
          // Fallback weather data
          setWeather({ 
            temperature: 24, 
            condition: 'Partly Cloudy', 
            location: 'Colombo' 
          });
        }
      } catch (error) {
        setWeather({ 
          temperature: 24, 
          condition: 'Partly Cloudy', 
          location: 'Colombo' 
        });
      }
    };
    fetchWeather();
  }, []);

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
        <div className="flex items-center gap-2 text-sm">
          <Thermometer className="h-4 w-4 text-orange-500" />
          <span className="font-medium text-foreground">{weather.temperature}°C</span>
          <span className="text-muted-foreground">{weather.condition}</span>
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