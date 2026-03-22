import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Employee = Tables<"employees">;
export type EmployeeInsert = TablesInsert<"employees">;
export type EmployeeUpdate = TablesUpdate<"employees">;

export function useEmployees() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employees")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Employee[];
    },
  });
}

export function useEmployeesWithAbsences(date?: string) {
  const targetDate = date || new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["employees-with-absences", targetDate],
    queryFn: async () => {
      const { data: employees, error: empError } = await supabase
        .from("employees")
        .select("*")
        .neq("status", "desligado")
        .order("name");
      if (empError) throw empError;

      // Try to fetch absences from employee_absences table (may not exist in types)
      let absences: any[] = [];
      try {
        const { data: absData, error: absError } = await supabase
          .from("employee_absences" as any)
          .select("*")
          .lte("start_date", targetDate)
          .gte("end_date", targetDate);
        if (!absError && absData) absences = absData as any[];
      } catch {
        // Table may not exist
      }

      // Get daily schedule entries for the date to see who's assigned
      const { data: entries, error: entError } = await supabase
        .from("daily_schedules")
        .select("id")
        .eq("schedule_date", targetDate)
        .maybeSingle();

      let assignedEmployeeIds: string[] = [];
      if (entries) {
        const { data: schedEntries } = await supabase
          .from("daily_schedule_entries")
          .select("employee_id, obra_id")
          .eq("daily_schedule_id", entries.id);
        assignedEmployeeIds = (schedEntries || []).map((e) => e.employee_id);
      }

      return (employees || []).map((emp) => {
        const activeAbsence = absences.find(
          (a: any) => a.employee_id === emp.id
        );
        const isAssigned = assignedEmployeeIds.includes(emp.id);

        let availability: "disponivel" | "ferias" | "licenca" | "afastado" | "em_obra" = "disponivel";
        if (emp.status === "ferias") availability = "ferias";
        else if (emp.status === "licenca") availability = "licenca";
        else if (emp.status === "afastado") availability = "afastado";
        else if (activeAbsence) {
          if (activeAbsence.absence_type === "ferias") availability = "ferias";
          else if (activeAbsence.absence_type?.startsWith("licenca")) availability = "licenca";
          else availability = "afastado";
        } else if (isAssigned) {
          availability = "em_obra";
        }

        return { ...emp, availability, activeAbsence };
      });
    },
  });
}

export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (employee: EmployeeInsert) => {
      const { data, error } = await supabase
        .from("employees")
        .insert(employee)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useUpdateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: EmployeeUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("employees")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}

export function useDeleteEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employees").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["employees"] }),
  });
}
