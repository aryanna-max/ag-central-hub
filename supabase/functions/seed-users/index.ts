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
      { email: "aryanna@agtopografia.com.br", full_name: "Aryanna", role: "master" },
      { email: "operacional@agtopografia.com.br", full_name: "Operacional AG", role: "operacional" },
      { email: "comercial@agtopografia.com.br", full_name: "Comercial AG", role: "comercial" },
      { email: "financeiro@agtopografia.com.br", full_name: "Financeiro AG", role: "financeiro" },
      { email: "gonzaga.sergio@gmail.com", full_name: "Sergio Gonzaga", role: "diretor" },
    ];

    const { data: listedUsers } = await adminClient.auth.admin.listUsers();
    const existingUsers = listedUsers?.users ?? [];
    const results = [];

    for (const item of users) {
      const email = item.email.trim().toLowerCase();
      const existing = existingUsers.find((user) => user.email?.toLowerCase() === email);

      if (existing) {
        const { error: updateUserError } = await adminClient.auth.admin.updateUserById(existing.id, {
          password: "32725203AG",
          email_confirm: true,
          user_metadata: { full_name: item.full_name },
        });

        if (updateUserError) {
          results.push({ email, status: "error", error: updateUserError.message });
          continue;
        }

        await adminClient.from("profiles").upsert({
          id: existing.id,
          email,
          full_name: item.full_name,
          must_change_password: true,
        });

        const { data: roleRow } = await adminClient
          .from("user_roles")
          .select("id, role")
          .eq("user_id", existing.id)
          .maybeSingle();

        if (roleRow) {
          await adminClient.from("user_roles").update({ role: item.role }).eq("id", roleRow.id);
        } else {
          await adminClient.from("user_roles").insert({ user_id: existing.id, role: item.role as any });
        }

        results.push({ email, status: "updated" });
        continue;
      }

      const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password: "32725203AG",
        email_confirm: true,
        user_metadata: { full_name: item.full_name },
      });

      if (createError || !newUser.user) {
        results.push({ email, status: "error", error: createError?.message ?? "Erro ao criar usuário" });
        continue;
      }

      await adminClient.from("profiles").upsert({
        id: newUser.user.id,
        email,
        full_name: item.full_name,
        must_change_password: true,
      });

      await adminClient.from("user_roles").insert({
        user_id: newUser.user.id,
        role: item.role as any,
      });

      results.push({ email, status: "created" });
    }

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Erro inesperado" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
