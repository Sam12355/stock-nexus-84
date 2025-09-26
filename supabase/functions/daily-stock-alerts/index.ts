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
    console.log('=== DAILY STOCK ALERTS STARTING ===');
    console.log('Time:', new Date().toISOString());

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get all branches with WhatsApp notifications enabled
    const { data: branches, error: branchError } = await supabase
      .from('branches')
      .select('*')
      .eq('notification_settings->>whatsapp', 'true');

    if (branchError) {
      console.error('Error fetching branches:', branchError);
      throw new Error('Failed to fetch branches');
    }

    console.log('Found branches with WhatsApp enabled:', branches?.length || 0);

    let totalNotificationsSent = 0;
    const alertsSummary = [];

    // Process each branch
    for (const branch of branches || []) {
      console.log(`\n--- Processing branch: ${branch.name} ---`);

      // Get all items and their stock levels for this branch
      const { data: stockItems, error: stockError } = await supabase
        .from('items')
        .select(`
          id,
          name,
          threshold_level,
          stock!inner(current_quantity)
        `)
        .eq('branch_id', branch.id);

      if (stockError) {
        console.error(`Error fetching stock for branch ${branch.name}:`, stockError);
        continue;
      }

      // Filter items that are low or critical
      const alertItems = stockItems?.filter(item => {
        const currentQty = item.stock?.[0]?.current_quantity || 0;
        const threshold = item.threshold_level;
        return currentQty <= threshold; // Low or critical
      }) || [];

      console.log(`Found ${alertItems.length} items needing alerts in ${branch.name}`);

      if (alertItems.length === 0) {
        console.log(`No stock alerts needed for ${branch.name}`);
        continue;
      }

      // Get users in this branch who should receive alerts
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('phone, name, role')
        .or(`branch_id.eq.${branch.id},role.in.(regional_manager,district_manager)`)
        .not('phone', 'is', null);

      if (usersError) {
        console.error(`Error fetching users for branch ${branch.name}:`, usersError);
        continue;
      }

      console.log(`Found ${users?.length || 0} users to notify in ${branch.name}`);

      // Prepare summary message
      const criticalItems = alertItems.filter(item => {
        const currentQty = item.stock?.[0]?.current_quantity || 0;
        const threshold = item.threshold_level;
        return currentQty <= threshold * 0.5;
      });

      const lowItems = alertItems.filter(item => {
        const currentQty = item.stock?.[0]?.current_quantity || 0;
        const threshold = item.threshold_level;
        return currentQty > threshold * 0.5 && currentQty <= threshold;
      });

      const message = `🏪 **${branch.name}** - Daily Stock Report
📅 ${new Date().toLocaleDateString()}

${criticalItems.length > 0 ? `🚨 **CRITICAL STOCK** (${criticalItems.length} items):
${criticalItems.map(item => {
  const qty = item.stock?.[0]?.current_quantity || 0;
  return `• ${item.name}: ${qty}/${item.threshold_level} units`;
}).join('\n')}

` : ''}${lowItems.length > 0 ? `⚠️ **LOW STOCK** (${lowItems.length} items):
${lowItems.map(item => {
  const qty = item.stock?.[0]?.current_quantity || 0;
  return `• ${item.name}: ${qty}/${item.threshold_level} units`;
}).join('\n')}

` : ''}${criticalItems.length > 0 ? '⚡ **Immediate restocking required for critical items!**' : '📈 **Please consider restocking soon.**'}

_Daily Stock Alert - Sushi Yama Inventory System_`;

      // Send WhatsApp notifications to all users
      for (const user of users || []) {
        if (!user.phone) continue;

        try {
          const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke('send-whatsapp-notification', {
            body: {
              phoneNumber: user.phone,
              message: message,
              type: 'stock_alert'
            }
          });

          if (whatsappError) {
            console.error(`WhatsApp failed for ${user.name}:`, whatsappError);
          } else {
            console.log(`WhatsApp sent to ${user.name} (${user.phone})`);
            totalNotificationsSent++;
          }
        } catch (error) {
          console.error(`Error sending WhatsApp to ${user.name}:`, error);
        }
      }

      alertsSummary.push({
        branch: branch.name,
        criticalItems: criticalItems.length,
        lowItems: lowItems.length,
        usersNotified: users?.length || 0
      });
    }

    const response = {
      success: true,
      message: 'Daily stock alerts completed',
      timestamp: new Date().toISOString(),
      summary: {
        branchesProcessed: branches?.length || 0,
        totalNotificationsSent,
        details: alertsSummary
      }
    };

    console.log('=== DAILY STOCK ALERTS COMPLETED ===');
    console.log('Summary:', response.summary);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in daily-stock-alerts function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false,
        timestamp: new Date().toISOString()
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