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
    console.log('=== DAILY EVENT REMINDERS (2:05 PM) ===');
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
    const remindersSummary = [];

    // Get today's and future events
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Process each branch
    for (const branch of branches || []) {
      console.log(`\n--- Processing branch: ${branch.name} ---`);

      // Get today's and future events for this branch
      const { data: events, error: eventsError } = await supabase
        .from('calendar_events')
        .select('*')
        .eq('branch_id', branch.id)
        .gte('event_date', today)
        .order('event_date', { ascending: true });

      if (eventsError) {
        console.error(`Error fetching events for branch ${branch.name}:`, eventsError);
        continue;
      }

      console.log(`Found ${events?.length || 0} upcoming events in ${branch.name}`);

      if (!events || events.length === 0) {
        console.log(`No upcoming events for ${branch.name}`);
        continue;
      }

      // Get users in this branch who should receive reminders
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('phone, name, role, notification_settings')
        .or(`branch_id.eq.${branch.id},role.in.(regional_manager,district_manager)`)
        .not('phone', 'is', null);

      if (usersError) {
        console.error(`Error fetching users for branch ${branch.name}:`, usersError);
        continue;
      }

      console.log(`Found ${users?.length || 0} users to notify in ${branch.name}`);

      // Group events by date
      const todayEvents = events.filter(e => e.event_date === today);
      const tomorrowEvents = events.filter(e => e.event_date === tomorrow);
      const futureEvents = events.filter(e => e.event_date > tomorrow);

      // Prepare reminder message
      let message = `📅 EVENT REMINDERS - ${branch.name}\n\n`;

      if (todayEvents.length > 0) {
        message += `🔴 TODAY (${new Date(today).toLocaleDateString()}):\n`;
        todayEvents.forEach(event => {
          message += `• ${event.title}\n`;
          if (event.description) {
            message += `  ${event.description}\n`;
          }
        });
        message += '\n';
      }

      if (tomorrowEvents.length > 0) {
        message += `🟡 TOMORROW (${new Date(tomorrow).toLocaleDateString()}):\n`;
        tomorrowEvents.forEach(event => {
          message += `• ${event.title}\n`;
          if (event.description) {
            message += `  ${event.description}\n`;
          }
        });
        message += '\n';
      }

      if (futureEvents.length > 0) {
        message += `📆 UPCOMING EVENTS:\n`;
        futureEvents.slice(0, 5).forEach(event => {
          const eventDate = new Date(event.event_date).toLocaleDateString();
          message += `• ${event.title} - ${eventDate}\n`;
        });
        if (futureEvents.length > 5) {
          message += `• ... and ${futureEvents.length - 5} more events\n`;
        }
        message += '\n';
      }

      message += `⏰ Daily reminders at 2:05 PM until event days pass.\n`;
      message += `📅 Reminder sent: ${new Date().toLocaleDateString()}\n\n`;
      message += `LBD Hospitals Event System`;

      // Filter users who have WhatsApp and Event Reminders enabled
      const eligibleUsers = users?.filter(user => {
        const userSettings = user.notification_settings || {};
        const branchWhatsappEnabled = branch.notification_settings?.whatsapp;
        const userWhatsappEnabled = userSettings.whatsapp;
        const eventRemindersEnabled = userSettings.eventReminders;
        
        // User needs both WhatsApp (branch OR user level) AND Event Reminders enabled
        const whatsappOk = branchWhatsappEnabled || userWhatsappEnabled;
        return whatsappOk && eventRemindersEnabled;
      }) || [];

      console.log(`Eligible users for daily event reminders: ${eligibleUsers.length}`);

      // Send notifications to eligible users (WhatsApp and Email)
      for (const user of eligibleUsers || []) {
        if (!user.phone) continue;

        try {
          // Send WhatsApp notification
          const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke('send-whatsapp-notification', {
            body: {
              phoneNumber: user.phone,
              message: message,
              type: 'event_reminder'
            }
          });

          // Send Email notification if user has email notifications enabled
          const userSettings = user.notification_settings || {};
          if (userSettings.email && user.email) {
            const emailSubject = `Event Reminders - ${branch.name}`;
            const emailBody = message.replace(/\n/g, '<br>');
            
            const { error: emailError } = await supabase.functions.invoke('send-email-notification', {
              body: {
                to: user.email,
                subject: emailSubject,
                body: emailBody,
                type: 'html'
              }
            });

            if (emailError) {
              console.error(`Email failed for ${user.name}:`, emailError);
            } else {
              console.log(`Email sent to ${user.name} (${user.email})`);
            }
          }

          if (whatsappError) {
            console.error(`WhatsApp failed for ${user.name}:`, whatsappError);
          } else {
            console.log(`WhatsApp sent to ${user.name} (${user.phone})`);
            totalNotificationsSent++;
          }
        } catch (error) {
          console.error(`Error sending notifications to ${user.name}:`, error);
        }
      }

      remindersSummary.push({
        branch: branch.name,
        todayEvents: todayEvents.length,
        tomorrowEvents: tomorrowEvents.length,
        usersNotified: users?.length || 0
      });
    }

    const response = {
      success: true,
      message: 'Daily event reminders completed',
      timestamp: new Date().toISOString(),
      summary: {
        branchesProcessed: branches?.length || 0,
        totalNotificationsSent,
        details: remindersSummary
      }
    };

    console.log('=== DAILY EVENT REMINDERS COMPLETED ===');
    console.log('Summary:', response.summary);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in daily-event-reminders function:', error);
    
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