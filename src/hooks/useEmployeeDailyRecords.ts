import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type EmployeeDailyRecordRow = Database["public"]["Tables"]["employee_daily_records"]["Row"];

export type EmployeeDailyRecordWithJoins = EmployeeDailyRecordRow & {
  employees: { name: string | null; matricula: string | null } | null;
  projects: { name: string | null; codigo: string | null } | null;
};

export function useEmployeeDailyRecords(filters: {
  employeeId?: string;
  startDate?: string;
  endDate?: string;
  projectId?: string;
}) {
  return useQuery<EmployeeDailyRecordWithJoins[]>({
    queryKey: ["employee-daily-records", filters],
    queryFn: async () => {
      let query = supabase.from("employee_daily_records")
        .select("*, employees(name, matricula), projects(name, codigo)")
        .order("schedule_date", { ascending: false });

      if (filters.employeeId) query = query.eq("employee_id", filters.employeeId);
      if (filters.startDate) query = query.gte("schedule_date", filters.startDate);
      if (filters.endDate) query = query.lte("schedule_date", filters.endDate);
      if (filters.projectId) query = query.eq("project_id", filters.projectId);

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as unknown as EmployeeDailyRecordWithJoins[];
    },
    enabled: !!(filters.employeeId || filters.startDate || filters.projectId),
  });
}
