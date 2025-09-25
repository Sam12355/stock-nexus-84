import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Twilio configuration
const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID');
const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN');
const TWILIO_WHATSAPP_FROM = 'whatsapp:+14155238886'; // Twilio Sandbox number

interface WhatsAppNotificationRequest {
  phoneNumber: string;
  message: string;
  type: 'stock_alert' | 'event_reminder' | 'whatsapp';
  itemName?: string;
  currentQuantity?: number;
  thresholdLevel?: number;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Invalid authentication');
    }

    const { phoneNumber, message, type, itemName, currentQuantity, thresholdLevel }: WhatsAppNotificationRequest = await req.json();

    // Validate input
    if (!phoneNumber || !message) {
      throw new Error('Phone number and message are required');
    }

    // Validate Twilio credentials
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials not configured');
    }

    // Format phone number for WhatsApp (ensure it starts with whatsapp:)
    const formattedPhoneNumber = phoneNumber.startsWith('whatsapp:') 
      ? phoneNumber 
      : `whatsapp:${phoneNumber}`;

    // Prepare Twilio API request
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
    
    const formData = new URLSearchParams();
    formData.append('From', TWILIO_WHATSAPP_FROM);
    formData.append('To', formattedPhoneNumber);
    formData.append('Body', message);

    // Create authorization header
    const credentials = btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`);
    
    console.log('=== SENDING WHATSAPP NOTIFICATION VIA TWILIO ===');
    console.log('To:', formattedPhoneNumber);
    console.log('From:', TWILIO_WHATSAPP_FROM);
    console.log('Type:', type);
    console.log('Message:', message);

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
    
    if (!twilioResponse.ok) {
      console.error('Twilio API Error:', twilioResult);
      throw new Error(`Twilio API Error: ${twilioResult.message || 'Unknown error'}`);
    }

    console.log('Twilio Response:', twilioResult);
    console.log('Message SID:', twilioResult.sid);
    console.log('Status:', twilioResult.status);
    console.log('===============================================');

    // Store notification record for tracking
    const { error: dbError } = await supabase.from('notifications').insert({
      recipient: phoneNumber,
      message: message,
      type: type,
      status: twilioResult.status || 'sent',
      subject: type === 'stock_alert' ? `Stock Alert: ${itemName}` : 'Notification',
      branch_id: null, // Will be set based on user's branch context
      sent_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error('Error storing notification record:', dbError);
      // Don't fail the request for logging errors
    }

    const response = {
      success: true,
      message: 'WhatsApp notification sent successfully via Twilio',
      details: {
        recipient: formattedPhoneNumber,
        type: type,
        sentAt: new Date().toISOString(),
        messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
        service: 'TWILIO_WHATSAPP_API',
        messageSid: twilioResult.sid,
        status: twilioResult.status
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
    console.error('Error in send-whatsapp-notification function:', error);
    
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