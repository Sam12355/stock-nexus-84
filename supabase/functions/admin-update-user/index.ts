import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type Role = 'regional_manager' | 'district_manager' | 'manager' | 'assistant_manager' | 'staff' | 'admin';

interface UpdateUserRequest {
  user_id: string;
  password?: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const admin = createClient(supabaseUrl, serviceKey);

    // Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');
    const token = authHeader.replace('Bearer ', '');

    const { data: { user: caller }, error: authError } = await admin.auth.getUser(token);
    if (authError || !caller) throw new Error('Invalid authentication');

    // Check caller role (must not be staff)
    const { data: callerProfile, error: profErr } = await admin
      .from('profiles')
      .select('role')
      .eq('user_id', caller.id)
      .single();
    if (profErr) throw profErr;
    if (callerProfile?.role === 'staff') {
      return new Response(JSON.stringify({ success: false, error: 'Not authorized' }), { status: 403, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const body: UpdateUserRequest = await req.json();
    const { user_id, password } = body;

    if (!user_id) {
      return new Response(JSON.stringify({ success: false, error: 'Missing user_id' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    // Only update password when provided and valid length
    if (password && password.length < 6) {
      return new Response(JSON.stringify({ success: false, error: 'Password must be at least 6 characters' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    if (password) {
      const { error: updErr } = await admin.auth.admin.updateUserById(user_id, { password });
      if (updErr) throw updErr;
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  } catch (e: any) {
    console.error('admin-update-user error:', e);
    return new Response(JSON.stringify({ success: false, error: e.message || 'Unexpected error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  }
});