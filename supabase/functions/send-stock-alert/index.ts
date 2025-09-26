import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StockAlertRequest {
  itemName: string;
  currentQuantity: number;
  thresholdLevel: number;
  alertType: 'low' | 'critical';
  branchId: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get Twilio credentials
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
    const TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'; // Twilio Sandbox number

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { itemName, currentQuantity, thresholdLevel, alertType, branchId }: StockAlertRequest = await req.json();

    console.log('=== STOCK ALERT TRIGGERED ===');
    console.log('Item:', itemName);
    console.log('Current Quantity:', currentQuantity);
    console.log('Threshold:', thresholdLevel);
    console.log('Alert Type:', alertType);
    console.log('Branch ID:', branchId);

    // Get branch information and notification settings
    const { data: branch, error: branchError } = await supabase
      .from('branches')
      .select('*')
      .eq('id', branchId)
      .single();

    if (branchError || !branch) {
      console.error('Branch not found:', branchError);
      throw new Error('Branch not found');
    }

    // Get users in the branch who should receive stock alerts
    // Include users from the branch AND regional/district managers
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('phone, name, role, notification_settings')
      .or(`branch_id.eq.${branchId},role.in.(regional_manager,district_manager)`)
      .not('phone', 'is', null);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw new Error('Failed to fetch users');
    }

    console.log('Found users for notification:', users?.length || 0);

    // Filter users who have both WhatsApp and Stock Level Alerts enabled
    const eligibleUsers = users?.filter(user => {
      const userSettings = user.notification_settings || {};
      const branchWhatsappEnabled = branch.notification_settings?.whatsapp;
      const userWhatsappEnabled = userSettings.whatsapp;
      const stockAlertsEnabled = userSettings.stockLevelAlerts;
      
      // User needs both WhatsApp (branch OR user level) AND Stock Level Alerts enabled
      const whatsappOk = branchWhatsappEnabled || userWhatsappEnabled;
      const eligibleForAlert = whatsappOk && stockAlertsEnabled;
      
      console.log(`User ${user.name} eligibility:`, {
        branchWhatsapp: branchWhatsappEnabled,
        userWhatsapp: userWhatsappEnabled,
        stockAlerts: stockAlertsEnabled,
        eligible: eligibleForAlert
      });
      
      return eligibleForAlert;
    }) || [];

    console.log('Eligible users for stock alerts:', eligibleUsers.length);

    // Prepare WhatsApp message
    const urgencyText = alertType === 'critical' ? '🚨 CRITICAL' : '⚠️ LOW STOCK';
    const message = `${urgencyText} ALERT

📦 Item: ${itemName}
📊 Current: ${currentQuantity} units
📋 Threshold: ${thresholdLevel} units
🏪 Branch: ${branch.name}

${alertType === 'critical' 
  ? '⚡ URGENT: Immediate restocking required!' 
  : '📈 Action needed: Please consider restocking soon.'
}

Time: ${new Date().toLocaleString()}`;

    const notifications = [];

    // Send WhatsApp notifications to eligible users via Twilio
    for (const user of eligibleUsers || []) {
      if (!user.phone || !TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) continue;

      try {
        // Format phone number for WhatsApp
        const formattedPhoneNumber = user.phone.startsWith('whatsapp:') 
          ? user.phone 
          : `whatsapp:${user.phone}`;

        // Prepare Twilio API request
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
        
        const formData = new URLSearchParams();
        formData.append('From', TWILIO_WHATSAPP_FROM);
        formData.append('To', formattedPhoneNumber);
        formData.append('Body', message);

        // Create authorization header
        const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
        
        console.log(`Sending WhatsApp to ${user.name} (${user.phone})`);

        // Send message via Twilio
        const twilioResponse = await fetch(twilioUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: formData.toString(),
        });

        const twilioResult = await twilioResponse.json();
        
        if (twilioResponse.ok) {
          console.log(`WhatsApp sent successfully to ${user.name}:`, twilioResult.sid);
          notifications.push({
            user: user.name,
            phone: user.phone,
            status: 'sent',
            messageSid: twilioResult.sid
          });

          // Log the notification to the database
          try {
            await supabase.from('notifications').insert({
              type: 'whatsapp',
              recipient: user.phone,
              subject: `${alertType} Stock Alert`,
              message: message,
              status: 'sent',
              branch_id: branchId,
              sent_at: new Date().toISOString()
            });
          } catch (dbError) {
            console.error('Error logging notification to DB:', dbError);
          }
        } else {
          console.error(`WhatsApp failed for ${user.name}:`, twilioResult);
        }
      } catch (error) {
        console.error(`Error sending WhatsApp to ${user.name}:`, error);
      }
    }

    const response = {
      success: true,
      message: 'Stock alert notifications processed',
      details: {
        itemName,
        alertType,
        branchName: branch.name,
        notificationsSent: notifications.length,
        notifications
      }
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in send-stock-alert function:', error);
    
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