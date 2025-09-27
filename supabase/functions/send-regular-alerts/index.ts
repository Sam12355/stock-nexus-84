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

    // Twilio configuration
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_WHATSAPP_FROM = Deno.env.get('TWILIO_WHATSAPP_FROM') || 'whatsapp:+14155238886';
    
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_WHATSAPP_FROM) {
      console.error('Missing Twilio environment variables');
      return new Response(JSON.stringify({ success: false, error: 'Twilio configuration missing' }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }
    
    // Helper to send WhatsApp via Twilio
    const sendWhatsApp = async (to: string, body: string) => {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const payload = new URLSearchParams({
        To: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
        From: TWILIO_WHATSAPP_FROM,
        Body: body,
      });
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: payload.toString(),
      });
      const json = await res.json();
      if (!res.ok) {
        console.error('Twilio error response:', json);
        throw new Error(json?.message || 'Twilio send failed');
      }
      return json;
    };
    
    console.log('=== SENDING REGULAR ALERTS ===');
    const now = new Date();
    console.log('Current time:', now.toLocaleString());

    // Get all users who have WhatsApp notifications enabled
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select(`
        id,
        user_id,
        name,
        phone,
        branch_id,
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
        const to = user.phone.startsWith('whatsapp:') ? user.phone : `whatsapp:${user.phone}`;
        const twilioResult = await sendWhatsApp(to, alertMessage);
        console.log('WhatsApp notification sent to:', user.name, 'SID:', twilioResult?.sid ?? 'unknown');
        
        // Best-effort log to notifications table (ignore errors)
        try {
          await supabase.from('notifications').insert({
            type: 'whatsapp',
            title: 'Regular Alert',
            message: alertMessage,
            recipient: user.phone,
            status: twilioResult?.status ?? 'queued',
            branch_id: (user as any).branch_id ?? (user as any).branches?.id ?? null,
            user_id: (user as any).id ?? null,
          });
        } catch (e) {
          console.error('Error storing notification record:', e);
        }
        
        notifications.push({
          user: user.name,
          phone: user.phone,
          status: 'sent'
        });
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