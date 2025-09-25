import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { User, Bell, Building, Save, Camera } from "lucide-react";

interface ExtendedProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  phone?: string;
  photo_url?: string;
  position?: string;
  role: string;
  branch_id?: string;
  branch_context?: string;
  created_at?: string;
  updated_at?: string;
  access_count?: number;
}

interface Branch {
  id: string;
  name: string;
  location?: string;
  notification_settings: {
    email: boolean;
    sms: boolean;
    whatsapp: boolean;
  };
  alert_frequency: string;
}

const Settings = () => {
  const { profile } = useAuth() as { profile: ExtendedProfile | null };
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [branch, setBranch] = useState<Branch | null>(null);
  
  // Profile settings
  const [profileData, setProfileData] = useState({
    name: profile?.name || '',
    email: profile?.email || '',
    phone: profile?.phone || '',
    position: profile?.position || ''
  });
  
  // Notification settings
  const [notifications, setNotifications] = useState({
    email: true,
    sms: false,
    whatsapp: false,
    stockAlerts: true,
    eventReminders: true
  });
  
  // Branch settings
  const [branchSettings, setBranchSettings] = useState({
    alertFrequency: 'weekly'
  });

  useEffect(() => {
    if (profile) {
      setProfileData({
        name: profile.name || '',
        email: profile.email || '',
        phone: profile.phone || '',
        position: profile.position || ''
      });
      
      fetchBranchSettings();
    }
  }, [profile]);

  const fetchBranchSettings = async () => {
    if (!profile?.branch_id && !profile?.branch_context) return;
    
    try {
      const branchId = profile.branch_id || profile.branch_context;
      const { data, error } = await supabase
        .from('branches')
        .select('*')
        .eq('id', branchId)
        .single();
        
      if (error) throw error;
      
      if (data) {
        setBranch(data);
        setNotifications(prev => ({
          ...prev,
          email: data.notification_settings?.email ?? true,
          sms: data.notification_settings?.sms ?? false,
          whatsapp: data.notification_settings?.whatsapp ?? false
        }));
        setBranchSettings({
          alertFrequency: data.alert_frequency || 'weekly'
        });
      }
    } catch (error) {
      console.error('Error fetching branch settings:', error);
    }
  };

  const updateProfile = async () => {
    if (!profile) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: profileData.name,
          phone: profileData.phone,
          position: profileData.position
        })
        .eq('id', profile.id);
        
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Error",
        description: "Failed to update profile",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateBranchSettings = async () => {
    if (!branch) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('branches')
        .update({
          notification_settings: {
            email: notifications.email,
            sms: notifications.sms,
            whatsapp: notifications.whatsapp
          },
          alert_frequency: branchSettings.alertFrequency
        })
        .eq('id', branch.id);
        
      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Branch settings updated successfully",
      });
    } catch (error) {
      console.error('Error updating branch settings:', error);
      toast({
        title: "Error",
        description: "Failed to update branch settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  if (!profile) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
      </div>
      
      <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
        {/* Profile Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input
                id="name"
                value={profileData.name}
                onChange={(e) => setProfileData({...profileData, name: e.target.value})}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={profileData.email}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={profileData.phone}
                onChange={(e) => setProfileData({...profileData, phone: e.target.value})}
                placeholder="Enter phone number"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                value={profileData.position}
                onChange={(e) => setProfileData({...profileData, position: e.target.value})}
                placeholder="Enter your position"
              />
            </div>
            
            <div className="space-y-2">
              <Label>Role</Label>
              <Input
                value={profile.role?.replace('_', ' ')?.toUpperCase()}
                disabled
                className="bg-muted"
              />
              <p className="text-xs text-muted-foreground">Role is assigned by administrators</p>
            </div>
            
            <Button onClick={updateProfile} disabled={loading} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Save Profile Changes
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              Notification Preferences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Stock Level Alerts</Label>
                  <p className="text-sm text-muted-foreground">Get notified when stock is low</p>
                </div>
                <Switch
                  checked={notifications.stockAlerts}
                  onCheckedChange={(checked) => 
                    setNotifications({...notifications, stockAlerts: checked})
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Event Reminders</Label>
                  <p className="text-sm text-muted-foreground">Get reminders for calendar events</p>
                </div>
                <Switch
                  checked={notifications.eventReminders}
                  onCheckedChange={(checked) => 
                    setNotifications({...notifications, eventReminders: checked})
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>Email Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                </div>
                <Switch
                  checked={notifications.email}
                  onCheckedChange={(checked) => 
                    setNotifications({...notifications, email: checked})
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>SMS Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive notifications via SMS</p>
                </div>
                <Switch
                  checked={notifications.sms}
                  onCheckedChange={(checked) => 
                    setNotifications({...notifications, sms: checked})
                  }
                />
              </div>
              
              <div className="flex items-center justify-between">
                <div>
                  <Label>WhatsApp Notifications</Label>
                  <p className="text-sm text-muted-foreground">Receive notifications via WhatsApp</p>
                </div>
                <Switch
                  checked={notifications.whatsapp}
                  onCheckedChange={(checked) => 
                    setNotifications({...notifications, whatsapp: checked})
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Branch Settings */}
        {(profile.role === 'manager' || profile.role === 'assistant_manager' || 
          profile.role === 'regional_manager' || profile.role === 'district_manager') && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                Branch Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {branch && (
                <>
                  <div className="space-y-2">
                    <Label>Branch Name</Label>
                    <Input value={branch.name} disabled className="bg-muted" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label>Branch Location</Label>
                    <Input value={branch.location || 'Not specified'} disabled className="bg-muted" />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="alertFrequency">Alert Frequency</Label>
                    <select
                      id="alertFrequency"
                      value={branchSettings.alertFrequency}
                      onChange={(e) => setBranchSettings({...branchSettings, alertFrequency: e.target.value})}
                      className="w-full p-2 border border-input rounded-md bg-background"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </div>
                  
                  <Button onClick={updateBranchSettings} disabled={loading} className="w-full">
                    <Save className="h-4 w-4 mr-2" />
                    Save Branch Settings
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* System Information */}
        <Card>
          <CardHeader>
            <CardTitle>System Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Account Created</Label>
              <Input 
                value={new Date(profile.created_at || '').toLocaleDateString()} 
                disabled 
                className="bg-muted" 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Last Updated</Label>
              <Input 
                value={new Date(profile.updated_at || '').toLocaleDateString()} 
                disabled 
                className="bg-muted" 
              />
            </div>
            
            <div className="space-y-2">
              <Label>Access Count</Label>
              <Input 
                value={profile.access_count?.toString() || '0'} 
                disabled 
                className="bg-muted" 
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Settings;