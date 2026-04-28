import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "@/contexts/AuthContext";

export interface UserProfile {
  id: string;
  email: string | null;
  full_name: string | null;
  role: AppRole | "sem_perfil";
}

export function useUsers() {
  return useQuery<UserProfile[]>({
    queryKey: ["users-with-roles"],
    queryFn: async () => {
      const [{ data: profiles, error: pErr }, { data: roles, error: rErr }] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pErr) throw pErr;
      if (rErr) throw rErr;
      const roleMap = new Map((roles ?? []).map((r) => [r.user_id, r.role as AppRole]));
      return (profiles ?? []).map((p) => ({
        id: p.id,
        email: p.email ?? null,
        full_name: p.full_name ?? null,
        role: (roleMap.get(p.id) as AppRole) ?? "sem_perfil",
      }));
    },
    staleTime: 60_000,
  });
}
