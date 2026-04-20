import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type JobRoleDepartment = "campo" | "sala_tecnica" | "administrativo" | "diretoria";

export type JobRole = {
  id: string;
  title: string;
  department: JobRoleDepartment;
  cbo_code: string | null;
  is_active: boolean;
  created_at: string;
};

export function useJobRoles() {
  return useQuery({
    queryKey: ["job-roles"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("job_roles")
        .select("*")
        .eq("is_active", true)
        .order("department")
        .order("title");
      if (error) throw error;
      return (data ?? []) as JobRole[];
    },
  });
}

export function useCreateJobRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      title: string;
      department: JobRoleDepartment;
      cbo_code?: string | null;
    }) => {
      const { data, error } = await (supabase as any)
        .from("job_roles")
        .insert({
          title: values.title.trim(),
          department: values.department,
          cbo_code: values.cbo_code?.trim() || null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as JobRole;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job-roles"] }),
  });
}
