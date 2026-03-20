import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const users = [
      { email: "aryanna@agtopografia.com.br", full_name: "Aryanna - Master", role: "master" },
      { email: "operacional@agtopografia.com.br", full_name: "Operacional AG", role: "operacional" },
    ];

    const results = [];

    for (const u of users) {
      // Check if user already exists
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const exists = existingUsers?.users?.find((eu: any) => eu.email === u.email);
      
      if (exists) {
        // Ensure profile and role exist
        await adminClient.from("profiles").upsert({
          id: exists.id,
          email: u.email,
          full_name: u.full_name,
          must_change_password: true,
        });
        await adminClient.from("user_roles").upsert({
          user_id: exists.id,
          role: u.role as any,
        }, { onConflict: "user_id,role" });
        results.push({ email: u.email, status: "already exists, ensured profile/role" });
        continue;
      }

      const { data: newUser, error } = await adminClient.auth.admin.createUser({
        email: u.email,
        password: "32725203AG",
        email_confirm: true,
        user_metadata: { full_name: u.full_name },
      });

      if (error) {
        results.push({ email: u.email, status: "error", error: error.message });
        continue;
      }

      await adminClient.from("profiles").insert({
        id: newUser.user.id,
        email: u.email,
        full_name: u.full_name,
        must_change_password: true,
      });

      await adminClient.from("user_roles").insert({
        user_id: newUser.user.id,
        role: u.role as any,
      });

      results.push({ email: u.email, status: "created" });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
