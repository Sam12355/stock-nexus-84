import { useAuth } from "@/hooks/useAuth";
import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { User, Bell, Building, Save } from "lucide-react";

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
  const [testMessageLoading, setTestMessageLoading] = useState(false);
  const [branch, setBranch] = useState<Branch | null>(null);

  // Guards against state being reset after user edits
  const [profileInitialized, setProfileInitialized] = useState(false);
  const [hasTouchedNotifications, setHasTouchedNotifications] = useState(false);
  const [hasTouchedBranch, setHasTouchedBranch] = useState(false);
  const hasTouchedNotificationsRef = useRef(false);
  const hasTouchedBranchRef = useRef(false);

  // Phone collection dialog state
  const [showPhoneDialog, setShowPhoneDialog] = useState(false);
  const [tempPhone, setTempPhone] = useState("");

  // Profile settings
  const [profileData, setProfileData] = useState({
    name: profile?.name || "",
    email: profile?.email || "",
    phone: profile?.phone || "",
    position: profile?.position || "",
  });

  // Notification settings - initialize from localStorage or defaults
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem(`notifications_${profile?.id}`);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Error parsing saved notifications:', e);
      }
    }
    return {
      email: true,
      sms: false,
      whatsapp: false,
      stockAlerts: true,
      eventReminders: true,
    };
  });

  // Save notifications to both localStorage and database
  const saveNotificationsToDatabase = async (notificationSettings: any) => {
    if (!profile?.id) return;
    
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ 
          notification_settings: {
            whatsapp: notificationSettings.whatsapp,
            stockLevelAlerts: notificationSettings.stockAlerts,
            eventReminders: notificationSettings.eventReminders
          }
        })
        .eq('id', profile.id);
        
      if (error) {
        console.error('Error saving notifications to database:', error);
      }
    } catch (error) {
      console.error('Error saving notifications to database:', error);
    }
  };

  // Persist notifications to localStorage AND database on change
  useEffect(() => {
    if (profile?.id) {
      try {
        localStorage.setItem(`notifications_${profile.id}`, JSON.stringify(notifications));
        // Also save to database for edge functions to access
        saveNotificationsToDatabase(notifications);
      } catch (e) {
        console.error('Error saving notifications:', e);
      }
    }
  }, [notifications, profile?.id]);

  // Hydrate notifications from localStorage and database
  useEffect(() => {
    if (!profile?.id) return;
    
    const loadNotificationSettings = async () => {
      // First try localStorage
      const saved = localStorage.getItem(`notifications_${profile.id}`);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setNotifications(parsed);
          hasTouchedNotificationsRef.current = true;
          return;
        } catch (e) {
          console.error('Error parsing saved notifications on hydrate:', e);
        }
      }
      
      // If no localStorage, try database
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('notification_settings')
          .eq('id', profile.id)
          .single();
          
        if (!error && data?.notification_settings) {
          const dbSettings = data.notification_settings;
          const mappedSettings = {
            email: true, // default
            sms: false, // default
            whatsapp: dbSettings.whatsapp || false,
            stockAlerts: dbSettings.stockLevelAlerts || false,
            eventReminders: dbSettings.eventReminders || false,
          };
          setNotifications(mappedSettings);
          // Also save to localStorage for faster access
          localStorage.setItem(`notifications_${profile.id}`, JSON.stringify(mappedSettings));
        }
      } catch (error) {
        console.error('Error loading notification settings from database:', error);
      }
    };
    
    loadNotificationSettings();
  }, [profile?.id]);

  // Branch settings
  const [branchSettings, setBranchSettings] = useState({
    alertFrequency: "weekly",
  });

  useEffect(() => {
    if (profile && !profileInitialized) {
      setProfileData({
        name: profile.name || "",
        email: profile.email || "",
        phone: profile.phone || "",
        position: profile.position || "",
      });
      setProfileInitialized(true);
    }
  }, [profile, profileInitialized]);

  useEffect(() => {
    if (profile?.branch_id || profile?.branch_context) {
      fetchBranchSettings();
    } else {
      setBranch(null);
    }
  }, [profile?.branch_id, profile?.branch_context]);

  const fetchBranchSettings = async () => {
    if (!profile?.branch_id && !profile?.branch_context) return;

    try {
      const branchId = profile.branch_id || profile.branch_context;
      const { data, error } = await supabase.from("branches").select("*").eq("id", branchId).maybeSingle();

      if (error) throw error;

      if (data) {
        // Always update branch data
        setBranch(data as Branch);
        
        // Only initialize notifications if they haven't been touched by user
        if (!hasTouchedNotificationsRef.current) {
          setNotifications((prev) => ({
            ...prev,
            email: data.notification_settings?.email ?? true,
            sms: data.notification_settings?.sms ?? false,
            whatsapp: data.notification_settings?.whatsapp ?? false,
          }));
        }
        
        // Always update branch settings
        setBranchSettings({
          alertFrequency: data.alert_frequency || "weekly",
        });
      }
    } catch (error) {
      console.error("Error fetching branch settings:", error);
    }
  };

  const updateProfile = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      const payload = {
        name: profileData.name.trim().slice(0, 100),
        phone: profileData.phone.trim().slice(0, 30),
        position: profileData.position.trim().slice(0, 100),
      };

      const { error } = await supabase.from("profiles").update(payload).eq("id", profile.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
    } catch (error) {
      console.error("Error updating profile:", error);
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
        .from("branches")
        .update({
          name: branch.name.trim().slice(0, 120),
          location: (branch.location || "").trim().slice(0, 120),
          notification_settings: {
            email: notifications.email,
            sms: notifications.sms,
            whatsapp: notifications.whatsapp,
          },
          alert_frequency: branchSettings.alertFrequency,
        })
        .eq("id", branch.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Branch settings updated successfully",
      });
    } catch (error) {
      console.error("Error updating branch settings:", error);
      toast({
        title: "Error",
        description: "Failed to update branch settings",
        variant: "destructive",
      });
    }
  };

  // Save individual notification setting immediately
  const saveNotificationSetting = async (settingType: 'email' | 'sms' | 'whatsapp' | 'stockAlerts' | 'eventReminders', value: boolean) => {
    try {
      // Save to localStorage for all notification preferences
      const updatedNotifications = { ...notifications, [settingType]: value };
      localStorage.setItem(`notifications_${profile?.id}`, JSON.stringify(updatedNotifications));

      // Only save to database for notification delivery methods, not user preferences
      if (['email', 'sms', 'whatsapp'].includes(settingType) && branch) {
        const updatedSettings = {
          ...branch.notification_settings,
          [settingType]: value
        };

        console.log(`Updating ${settingType} notification setting to:`, value);
        console.log('Updated notification settings:', updatedSettings);

        const { error } = await supabase
          .from("branches")
          .update({
            notification_settings: updatedSettings
          })
          .eq("id", branch.id);

        if (error) {
          console.error('Database update error:', error);
          throw error;
        }
        
        console.log(`Successfully updated ${settingType} in database`);
        
        // Update local branch state to reflect the change
        setBranch(prev => prev ? {
          ...prev,
          notification_settings: updatedSettings
        } : prev);
      }

      console.log(`${settingType} notification setting saved:`, value);
    } catch (error) {
      console.error(`Error saving ${settingType} notification setting:`, error);
      toast({
        title: "Error",
        description: `Failed to save ${settingType} notification setting`,
        variant: "destructive",
      });
    }
  };

  // Handle WhatsApp notification toggle with phone validation
  const handleWhatsAppToggle = async (checked: boolean) => {
    if (checked && (!profileData.phone || profileData.phone.trim() === "")) {
      setTempPhone("");
      setShowPhoneDialog(true);
      return;
    }
    
    setHasTouchedNotifications(true);
    hasTouchedNotificationsRef.current = true;
    setNotifications((prev) => ({ ...prev, whatsapp: checked }));
    
    // Immediately save the setting to the database
    await saveNotificationSetting('whatsapp', checked);
  };

  // Save phone number and enable WhatsApp
  const savePhoneAndEnableWhatsApp = async () => {
    if (!tempPhone.trim()) {
      toast({
        title: "Error",
        description: "Please enter a valid phone number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Update profile with phone number
      const { error } = await supabase
        .from("profiles")
        .update({ phone: tempPhone.trim() })
        .eq("id", profile?.id);

      if (error) throw error;

      // Update local state
      setProfileData(prev => ({ ...prev, phone: tempPhone.trim() }));
      
       // Enable WhatsApp notifications
       setHasTouchedNotifications(true);
       hasTouchedNotificationsRef.current = true;
       setNotifications((prev) => ({ ...prev, whatsapp: true }));
       
       // Save WhatsApp notification setting to database
       await saveNotificationSetting('whatsapp', true);
      
      setShowPhoneDialog(false);
      
      // Send test WhatsApp notification
      await sendTestWhatsAppNotification(tempPhone.trim());
      
      toast({
        title: "Success",
        description: "Phone number saved and WhatsApp notifications enabled. Check console for test message!",
      });
    } catch (error) {
      console.error("Error saving phone:", error);
      toast({
        title: "Error",
        description: "Failed to save phone number",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Send test WhatsApp notification
  const sendTestWhatsAppNotification = async (phone: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-notification', {
        body: {
          phoneNumber: phone,
          message: `Welcome to ${branch?.name || 'your branch'} inventory management! WhatsApp notifications are now enabled for stock alerts and reminders.`,
          type: 'whatsapp'
        }
      });

      if (error) {
        console.error('WhatsApp test error:', error);
      } else {
        console.log('WhatsApp test sent:', data);
      }
    } catch (error) {
      console.error('Error sending test WhatsApp:', error);
    }
  };

  // Send test hello message
  const sendTestHelloMessage = async () => {
    if (!profileData.phone || profileData.phone.trim() === "") {
      toast({
        title: "Error",
        description: "Please add a phone number first",
        variant: "destructive",
      });
      return;
    }

    setTestMessageLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp-notification', {
        body: {
          phoneNumber: profileData.phone,
          message: 'Hello! This is a test message from your inventory management system.',
          type: 'whatsapp'
        }
      });

      if (error) {
        console.error('WhatsApp test error:', error);
        toast({
          title: "Error",
          description: "Failed to send test message",
          variant: "destructive",
        });
      } else {
        console.log('WhatsApp test sent:', data);
        toast({
          title: "Success",
          description: "Test message sent! Check your WhatsApp.",
        });
      }
    } catch (error) {
      console.error('Error sending test WhatsApp:', error);
      toast({
        title: "Error",
        description: "Failed to send test message",
        variant: "destructive",
      });
    } finally {
      setTestMessageLoading(false);
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
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input id="email" type="email" value={profileData.email} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                value={profileData.phone}
                onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                placeholder="Enter phone number"
                maxLength={30}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="position">Position</Label>
              <Input
                id="position"
                value={profileData.position}
                onChange={(e) => setProfileData({ ...profileData, position: e.target.value })}
                placeholder="Enter your position"
                maxLength={100}
              />
            </div>

            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={profile.role?.replace("_", " ")?.toUpperCase()} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Role is assigned by administrators</p>
            </div>

            <Button onClick={updateProfile} disabled={loading} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              Save Profile Changes
            </Button>
          </CardContent>
        </Card>

        {/* Notification Settings - hidden for staff */}
        {profile.role !== 'staff' && (
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
                    onCheckedChange={async (checked) => {
                      setHasTouchedNotifications(true);
                      hasTouchedNotificationsRef.current = true;
                      setNotifications((prev) => ({ ...prev, stockAlerts: checked }));
                      await saveNotificationSetting('stockAlerts', checked);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Event Reminders</Label>
                    <p className="text-sm text-muted-foreground">Get reminders for calendar events</p>
                  </div>
                  <Switch
                    checked={notifications.eventReminders}
                    onCheckedChange={async (checked) => {
                      setHasTouchedNotifications(true);
                      hasTouchedNotificationsRef.current = true;
                      setNotifications((prev) => ({ ...prev, eventReminders: checked }));
                      await saveNotificationSetting('eventReminders', checked);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Email Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via email</p>
                  </div>
                  <Switch
                    checked={notifications.email}
                    onCheckedChange={async (checked) => {
                      setHasTouchedNotifications(true);
                      hasTouchedNotificationsRef.current = true;
                      setNotifications((prev) => ({ ...prev, email: checked }));
                      await saveNotificationSetting('email', checked);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>SMS Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via SMS</p>
                  </div>
                  <Switch
                    checked={notifications.sms}
                    onCheckedChange={async (checked) => {
                      setHasTouchedNotifications(true);
                      hasTouchedNotificationsRef.current = true;
                      setNotifications((prev) => ({ ...prev, sms: checked }));
                      await saveNotificationSetting('sms', checked);
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>WhatsApp Notifications</Label>
                    <p className="text-sm text-muted-foreground">Receive notifications via WhatsApp</p>
                  </div>
                  <Switch
                    checked={notifications.whatsapp}
                    onCheckedChange={handleWhatsAppToggle}
                  />
                </div>
              </div>

            </CardContent>
          </Card>
)}

        {/* Branch Settings */}
        {(profile.role === "manager" ||
          profile.role === "assistant_manager") && (
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
                    <Input
                      value={branch.name}
                      maxLength={120}
                      disabled={true}
                      onChange={(e) => {
                        setHasTouchedBranch(true);
                        hasTouchedBranchRef.current = true;
                        setBranch((prev) => (prev ? { ...prev, name: e.target.value } : prev));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Branch Location</Label>
                    <Input
                      value={branch.location || ""}
                      maxLength={120}
                      disabled={true}
                      onChange={(e) => {
                        setHasTouchedBranch(true);
                        hasTouchedBranchRef.current = true;
                        setBranch((prev) => (prev ? { ...prev, location: e.target.value } : prev));
                      }}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="alertFrequency">Alert Frequency</Label>
                    <select
                      id="alertFrequency"
                      value={branchSettings.alertFrequency}
                      onChange={(e) =>
                        setBranchSettings({ ...branchSettings, alertFrequency: e.target.value })
                      }
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
                value={new Date(profile.created_at || "").toLocaleDateString()}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label>Last Updated</Label>
              <Input
                value={new Date(profile.updated_at || "").toLocaleDateString()}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="space-y-2">
              <Label>Access Count</Label>
              <Input value={profile.access_count?.toString() || "0"} disabled className="bg-muted" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Phone Number Collection Dialog */}
      <Dialog open={showPhoneDialog} onOpenChange={setShowPhoneDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Phone Number</DialogTitle>
            <DialogDescription>
              Please enter your phone number to enable WhatsApp notifications.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <Input
                id="phone"
                placeholder="Enter your phone number (e.g., +1234567890)"
                value={tempPhone}
                onChange={(e) => setTempPhone(e.target.value)}
                maxLength={30}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={() => setShowPhoneDialog(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button 
                onClick={savePhoneAndEnableWhatsApp}
                disabled={loading || !tempPhone.trim()}
                className="flex-1"
              >
                {loading ? "Saving..." : "Save & Enable"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Settings;
