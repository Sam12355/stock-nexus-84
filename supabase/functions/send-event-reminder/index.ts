import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EventReminderRequest {
  eventTitle: string;
  eventDescription?: string;
  eventDate: string;
  eventType: string;
  branchId: string;
  reminderType: 'immediate' | '1day' | '1hour';
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

    const { eventTitle, eventDescription, eventDate, eventType, branchId, reminderType }: EventReminderRequest = await req.json();

    console.log('=== EVENT REMINDER TRIGGERED ===');
    console.log('Event:', eventTitle);
    console.log('Date:', eventDate);
    console.log('Type:', eventType);
    console.log('Branch ID:', branchId);
    console.log('Reminder Type:', reminderType);

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

    // Get users in the branch who should receive event reminders
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

    // Prepare reminder timing text
    let timingText = '';
    switch (reminderType) {
      case 'immediate':
        timingText = '📅 New Event Created';
        break;
      case '1day':
        timingText = '⏰ Tomorrow';
        break;
      case '1hour':
        timingText = '🔔 Starting in 1 hour';
        break;
    }

    // Format event date
    const eventDateTime = new Date(eventDate);
    const dateStr = eventDateTime.toLocaleDateString();
    const timeStr = eventDateTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    // Prepare WhatsApp message
    const message = `${timingText} REMINDER

📋 Event: ${eventTitle}
${eventDescription ? `📝 ${eventDescription}\n` : ''}📅 Date: ${dateStr}
🕐 Time: ${timeStr}
🏪 Branch: ${branch.name}
📌 Type: ${eventType}

${reminderType === '1hour' 
  ? '⚡ Starting soon - please prepare!' 
  : reminderType === '1day'
  ? '📅 Don\'t forget about tomorrow\'s event!'
  : '✨ New event added to your calendar'
}

Sent: ${new Date().toLocaleString()}`;

    const notifications = [];

    // Send WhatsApp notifications to eligible users
    for (const user of users || []) {
      if (!user.phone) continue;

      try {
        const { data: whatsappResult, error: whatsappError } = await supabase.functions.invoke('send-whatsapp-notification', {
          body: {
            phoneNumber: user.phone,
            message: message,
            type: 'event_reminder'
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
      message: 'Event reminder notifications processed',
      details: {
        eventTitle,
        eventDate,
        reminderType,
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
    console.error('Error in send-event-reminder function:', error);
    
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