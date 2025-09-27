import { createContext, useContext, useEffect, useState, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  photo_url?: string;
  position?: string;
  role: 'regional_manager' | 'district_manager' | 'manager' | 'assistant_manager' | 'staff';
  branch_id?: string;
  branch_context?: string;
  region_id?: string;
  district_id?: string;
  last_access?: string;
  access_count: number;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  fetchProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const suppressToastsRef = useRef(false);

  const fetchProfile = async () => {
    if (!user) return;
    
    try {
      console.log('Fetching profile for user:', user.id);
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;

      // Update access tracking once per day per user
      if (data) {
        const trackKey = `access-tracked:${user.id}:${new Date().toDateString()}`;
        if (!localStorage.getItem(trackKey)) {
          const { data: updatedData, error: updateError } = await supabase
            .from('profiles')
            .update({ 
              last_access: new Date().toISOString(),
              access_count: (data.access_count || 0) + 1 
            })
            .eq('user_id', user.id)
            .select()
            .single();
          
          localStorage.setItem(trackKey, '1');
          
          // Use updated data with incremented access_count
          if (!updateError && updatedData) {
            console.log('Profile updated with access tracking:', updatedData);
            setProfile(updatedData);
            return;
          }
        }
      }

      console.log('Profile query result:', { data, error });
      setProfile(data);
        
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      // Only show error toast if user is still authenticated
      if (session?.user && !suppressToastsRef.current) {
        toast({
          title: "Error",
          description: "Failed to load user profile",
          variant: "destructive",
        });
      }
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) throw error;
      
      // Log login activity
      setTimeout(async () => {
        try {
          await supabase.rpc('log_user_activity', {
            p_action: 'login',
            p_details: JSON.stringify({ method: 'email' })
          });
        } catch (logError) {
          console.warn('Failed to log login activity:', logError);
        }
      }, 0);
      
      toast({
        title: "Welcome back!",
        description: "Successfully signed in to your account",
      });
      
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Sign in failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
      return { error };
    }
  };

  const signUp = async (email: string, password: string, name: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            name: name,
          }
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Account created!",
        description: "Welcome to the Inventory Management System",
      });
      
      return { error: null };
    } catch (error: any) {
      toast({
        title: "Sign up failed",
        description: error.message || "Failed to create account",
        variant: "destructive",
      });
      return { error };
    }
  };

  const signOut = async () => {
    try {
      suppressToastsRef.current = true;
      // Log logout activity before signing out
      if (user?.id) {
        try {
          await supabase.rpc('log_user_activity', {
            p_action: 'logout',
            p_details: JSON.stringify({ timestamp: new Date().toISOString() })
          });
        } catch (logError) {
          console.warn('Failed to log logout activity:', logError);
        }
        
        // Clear branch_context before signing out
        try {
          await supabase
            .from('profiles')
            .update({ branch_context: null })
            .eq('user_id', user.id);
        } catch (updateError) {
          console.warn('Failed to update branch context:', updateError);
        }
      }
      
      await supabase.auth.signOut();
      setUser(null);
      setSession(null);
      setProfile(null);
      
      toast({
        title: "Signed out",
        description: "You have been successfully signed out",
      });
      setTimeout(() => { suppressToastsRef.current = false; }, 300);
    } catch (error: any) {
      console.error('Error signing out:', error);
      // Only show error toast for actual sign-out failures, not profile update failures
      if (error.message && !error.message.includes('profile')) {
        toast({
          title: "Error",
          description: "Failed to sign out",
          variant: "destructive",
        });
      }
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', user.id);

      if (error) throw error;
      
      setProfile(prev => prev ? { ...prev, ...updates } : null);
      
      // Log profile update as a general activity (defer to avoid auth callback deadlocks)
      setTimeout(async () => {
        try {
          await supabase.rpc('log_user_activity', {
            p_action: 'profile_updated',
            p_details: JSON.stringify({ fields: Object.keys(updates || {}) })
          });
        } catch (logError) {
          console.warn('Failed to log profile update:', logError);
        }
      }, 0);
      
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated",
      });
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (!session?.user) {
          setProfile(null);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        setTimeout(() => {
          fetchProfile();
        }, 0);
      }
      
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel('realtime:profiles')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'profiles',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        // For updates/inserts, update local profile state
        if (payload.eventType === 'UPDATE' || payload.eventType === 'INSERT') {
          // @ts-ignore - payload.new is typed as unknown by supabase-js
          setProfile(payload.new as any);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const value = {
    user,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signOut,
    updateProfile,
    fetchProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}