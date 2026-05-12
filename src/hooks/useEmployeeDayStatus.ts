import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type DayType = Database["public"]["Enums"]["day_type"];
export type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

export interface EmployeeDayStatus {
  day_type: DayType | null;
  attendance: AttendanceStatus | null;
  project_id: string | null;
  project_name: string | null;
  project_codigo: string | null;
  absence_reason: string | null;
  validated_at: string | null;
  validated_by_id: string | null;
  conta_como_dia_util: boolean;
  conta_como_vt: boolean;
}

export function useEmployeeDayStatus(employeeId: string | null, date: string | null) {
  return useQuery({
    queryKey: ["employee-day-status", employeeId, date],
    enabled: !!employeeId && !!date,
    queryFn: async (): Promise<EmployeeDayStatus | null> => {
      const { data, error } = await supabase.rpc("fn_employee_day_status", {
        p_employee_id: employeeId!,
        p_date: date!,
      });
      if (error) throw error;
      return (data && data[0]) || null;
    },
  });
}
