import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  type?: 'text' | 'html';
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, body, type = 'text' }: EmailRequest = await req.json();

    // Get SMTP configuration from environment
    const SMTP_HOST = Deno.env.get('SMTP_HOST');
    const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') || '587');
    const SMTP_USERNAME = Deno.env.get('SMTP_USERNAME');
    const SMTP_PASSWORD = Deno.env.get('SMTP_PASSWORD');

    if (!SMTP_HOST || !SMTP_USERNAME || !SMTP_PASSWORD) {
      console.error('Missing SMTP configuration');
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Email service not configured' 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    // Create email message
    const message = [
      `From: ${SMTP_USERNAME}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Content-Type: ${type === 'html' ? 'text/html' : 'text/plain'}; charset=utf-8`,
      '',
      body
    ].join('\r\n');

    // Send email using SMTP
    const response = await fetch(`https://api.smtp2go.com/v3/email/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Smtp2go-Api-Key': SMTP_PASSWORD, // Using password as API key for external service
      },
      body: JSON.stringify({
        to: [to],
        from: SMTP_USERNAME,
        subject: subject,
        text_body: type === 'text' ? body : undefined,
        html_body: type === 'html' ? body : undefined,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error('Email sending failed:', result);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to send email' 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    }

    console.log('Email sent successfully:', { to, subject });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Email sent successfully',
      messageId: result.data?.message_id
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error: any) {
    console.error('Error in send-email function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error occurred' 
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);