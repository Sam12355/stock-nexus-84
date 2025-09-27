import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('=== SENDING REGULAR ALERTS ===');
    
    const now = new Date();
    console.log('Current time:', now.toLocaleString());

    // Get all users who have WhatsApp notifications enabled
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        phone,
        notification_settings,
        branches (
          id,
          name,
          notification_settings
        )
      `)
      .not('phone', 'is', null)
      .eq('notification_settings->>whatsapp', 'true');

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw new Error('Failed to fetch users');
    }

    console.log('Found users with WhatsApp enabled:', users?.length || 0);

    const notifications = [];

    for (const user of users || []) {
      if (!user.phone || !user.notification_settings?.whatsapp) continue;

      const alertMessage = `🔔 REGULAR ALERT

👋 Hi ${user.name}!
⏰ Time: ${now.toLocaleString()}
🏪 Branch: ${user.branches?.name || 'Your Branch'}

This is your automated 5-minute alert.
System is working perfectly! ✅

Next alert in 5 minutes.`;

      try {
        const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke('send-whatsapp-notification', {
          body: {
            phoneNumber: user.phone,
            message: alertMessage,
            type: 'whatsapp'
          }
        });

        if (whatsappError) {
          console.error('WhatsApp notification failed for user:', user.name, whatsappError);
        } else {
          console.log('WhatsApp notification sent to:', user.name);
          notifications.push({
            user: user.name,
            phone: user.phone,
            status: 'sent'
          });
        }
      } catch (error) {
        console.error('Error sending WhatsApp to user:', user.name, error);
      }
    }

    const response = {
      success: true,
      message: 'Regular alerts processed successfully',
      alertsSent: notifications.length,
      details: notifications
    };

    console.log('Regular alerts processing completed:', response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in send-regular-alerts function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        status: 500,
        headers: { 
          'Content-Type': 'application/json', 
          ...corsHeaders 
        },
      }
    );
  }
};

serve(handler);