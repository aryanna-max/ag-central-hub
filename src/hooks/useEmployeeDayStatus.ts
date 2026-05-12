import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DayType = "projeto" | "reserva_ag" | "folga" | "atestado" | "falta";

export type EmployeeDayStatus = {
  day_type: DayType;
  attendance: Database["public"]["Enums"]["attendance_status"] | null;
  project_id: string | null;
  project_name: string | null;
  project_codigo: string | null;
  absence_reason: string | null;
  conta_como_dia_util: boolean;
  conta_como_vt: boolean;
};

export function useEmployeeDayStatus(
  employeeId: string | undefined,
  date: string | undefined,
) {
  return useQuery({
    queryKey: ["employee-day-status", employeeId, date],
    queryFn: async (): Promise<EmployeeDayStatus | null> => {
      if (!employeeId || !date) return null;
      const { data, error } = await supabase.rpc("fn_employee_day_status", {
        p_employee_id: employeeId,
        p_date: date,
      });
      if (error) throw error;
      const rows = (data ?? []) as EmployeeDayStatus[];
      return rows[0] ?? null;
    },
    enabled: !!employeeId && !!date,
  });
}
