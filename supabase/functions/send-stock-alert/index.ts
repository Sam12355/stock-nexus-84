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

    // Check if WhatsApp notifications are enabled for this branch
    if (!branch.notification_settings?.whatsapp) {
      console.log('WhatsApp notifications disabled for this branch');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'WhatsApp notifications disabled for this branch' 
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    // Get users in the branch who should receive stock alerts
    const { data: users, error: usersError } = await supabase
      .from('profiles')
      .select('phone, name, role')
      .or(`branch_id.eq.${branchId},role.in.(regional_manager,district_manager)`)
      .not('phone', 'is', null);

    if (usersError) {
      console.error('Error fetching users:', usersError);
      throw new Error('Failed to fetch users');
    }

    console.log('Found users for notification:', users?.length || 0);

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

    // Send WhatsApp notifications to eligible users
    for (const user of users || []) {
      if (!user.phone) continue;

      try {
        const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke('send-whatsapp-notification', {
          body: {
            phoneNumber: user.phone,
            message: message,
            type: 'stock_alert',
            itemName: itemName,
            currentQuantity: currentQuantity,
            thresholdLevel: thresholdLevel
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