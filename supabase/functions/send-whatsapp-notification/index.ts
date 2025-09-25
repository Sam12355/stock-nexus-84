import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WhatsAppNotificationRequest {
  phoneNumber: string;
  message: string;
  type: 'stock_alert' | 'event_reminder' | 'general';
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

    console.log('=== MOCK WHATSAPP NOTIFICATION ===');
    console.log('To:', phoneNumber);
    console.log('Type:', type);
    console.log('Message:', message);
    
    if (type === 'stock_alert' && itemName) {
      console.log('Item:', itemName);
      console.log('Current Quantity:', currentQuantity);
      console.log('Threshold:', thresholdLevel);
    }
    
    console.log('Timestamp:', new Date().toISOString());
    console.log('=====================================');

    // Store notification record for tracking
    const { error: dbError } = await supabase.from('notifications').insert({
      recipient: phoneNumber,
      message: message,
      type: type,
      status: 'sent', // Mock as sent for testing
      subject: type === 'stock_alert' ? `Stock Alert: ${itemName}` : 'Notification',
      branch_id: null, // Will be set based on user's branch context
      sent_at: new Date().toISOString(),
    });

    if (dbError) {
      console.error('Error storing notification record:', dbError);
      // Don't fail the request for logging errors
    }

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 500));

    const response = {
      success: true,
      message: 'WhatsApp notification sent successfully (MOCK)',
      details: {
        recipient: phoneNumber,
        type: type,
        sentAt: new Date().toISOString(),
        messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
        service: 'MOCK_WHATSAPP_API'
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