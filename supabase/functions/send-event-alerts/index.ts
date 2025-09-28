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

    console.log('=== CHECKING FOR EVENT ALERTS ===');
    
    // Get current date and time
    const now = new Date();
    const currentDate = now.toISOString().split('T')[0]; // YYYY-MM-DD format
    const currentTime = now.toTimeString().split(' ')[0]; // HH:MM:SS format

    console.log('Current date:', currentDate);
    console.log('Current time:', currentTime);

    // Find pending event alerts for today at 8:00 AM
    const { data: alerts, error: alertsError } = await supabase
      .from('event_alerts')
      .select(`
        *,
        calendar_events (
          id,
          title,
          description,
          event_type,
          event_date
        ),
        branches (
          id,
          name,
          notification_settings
        )
      `)
      .eq('alert_date', currentDate)
      .eq('alert_time', '23:40:00')
      .eq('status', 'pending')
      .gte('alert_time', currentTime.substring(0, 5) + ':00') // Check if it's time to send
      .lte('alert_time', '23:45:00'); // 5-minute window

    if (alertsError) {
      console.error('Error fetching alerts:', alertsError);
      throw new Error('Failed to fetch event alerts');
    }

    console.log('Found alerts to process:', alerts?.length || 0);

    const processedAlerts = [];

    for (const alert of alerts || []) {
      const { calendar_events: event, branches: branch } = alert;
      
      if (!event || !branch) {
        console.log('Skipping alert - missing event or branch data');
        continue;
      }

      // Check if WhatsApp notifications are enabled for this branch
      if (!branch.notification_settings?.whatsapp) {
        console.log(`WhatsApp notifications disabled for branch: ${branch.name}`);
        continue;
      }

      // Get users in the branch who should receive event alerts
      const { data: users, error: usersError } = await supabase
        .from('profiles')
        .select('phone, name, role, notification_settings')
        .eq('branch_id', branch.id)
        .not('phone', 'is', null);

      if (usersError) {
        console.error('Error fetching users:', usersError);
        continue;
      }

      // Filter users who have event reminders enabled
      const eligibleUsers = users?.filter(user => 
        user.notification_settings?.eventReminders === true
      ) || [];

      console.log(`Found ${eligibleUsers.length} eligible users for branch: ${branch.name}`);

      // Format event date
      const eventDate = new Date(event.event_date);
      const dateStr = eventDate.toLocaleDateString();

      // Prepare WhatsApp message
      const message = `🚨 EVENT ALERT REMINDER

📋 Event: ${event.title}
${event.description ? `📝 ${event.description}\n` : ''}📅 Date: ${dateStr}
🏪 Branch: ${branch.name}
📌 Type: ${event.event_type}

⏰ This event is scheduled for today!
Please prepare accordingly.

Sent: ${new Date().toLocaleString()}`;

      const notifications = [];

      // Send WhatsApp notifications to eligible users
      for (const user of eligibleUsers) {
        if (!user.phone) continue;

        try {
          const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke('send-whatsapp-notification', {
            body: {
              phoneNumber: user.phone,
              message: message,
              type: 'event_alert'
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

      // Create in-app notification for the branch
      try {
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            type: 'event_alert',
            subject: `Event Alert: ${event.title}`,
            message: `Event "${event.title}" is scheduled for today at your branch.`,
            recipient: 'branch',
            branch_id: branch.id,
            status: 'sent',
            sent_at: new Date().toISOString()
          });

        if (notificationError) {
          console.error('Error creating in-app notification:', notificationError);
        } else {
          console.log('In-app notification created for branch:', branch.name);
        }
      } catch (error) {
        console.error('Error creating in-app notification:', error);
      }

      // Mark alert as sent
      const { error: updateError } = await supabase
        .from('event_alerts')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', alert.id);

      if (updateError) {
        console.error('Error updating alert status:', updateError);
      }

      processedAlerts.push({
        alertId: alert.id,
        eventTitle: event.title,
        branchName: branch.name,
        notificationsSent: notifications.length,
        notifications
      });
    }

    const response = {
      success: true,
      message: 'Event alerts processed successfully',
      alertsProcessed: processedAlerts.length,
      details: processedAlerts
    };

    console.log('Event alerts processing completed:', response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in send-event-alerts function:', error);
    
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
