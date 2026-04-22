import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";
import { FIELD_ROLES, isFieldRole } from "@/lib/fieldRoles";

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
        .neq("status", "desligado")
        .order("name");
      if (error) throw error;
      return data as Employee[];
    },
  });
}

export type EmployeeAvailability =
  | "disponivel"
  | "ferias"
  | "licenca"
  | "afastado"
  | "em_projeto";

export type ActiveAbsence = {
  start_date: string;
  end_date: string;
  notes: string | null;
  absence_type: "ferias";
};

export type EmployeeWithAvailability = Employee & {
  availability: EmployeeAvailability;
  activeAbsence: ActiveAbsence | null;
};

export function useEmployeesWithAbsences(date?: string) {
  const targetDate = date || new Date().toISOString().split("T")[0];
  return useQuery({
    queryKey: ["employees-with-absences", targetDate],
    queryFn: async (): Promise<EmployeeWithAvailability[]> => {
      const { data: allEmployees, error: empError } = await supabase
        .from("employees")
        .select("*")
        .neq("status", "desligado")
        .order("name");
      if (empError) throw empError;
      // Filter field roles client-side for case-insensitive partial matching
      const employees = (allEmployees || []).filter((e) => isFieldRole(e.role));

      // Fonte única: employee_vacations (tabela employee_absences foi DROP
      // na migration 20260422_ferias_cleanup_dados_teste.sql — Onda de fix).
      const { data: vacationsData } = await supabase
        .from("employee_vacations")
        .select("employee_id, start_date, end_date, notes")
        .lte("start_date", targetDate)
        .gte("end_date", targetDate);

      const vacations = vacationsData ?? [];

      // Get daily schedule entries for the date to see who's assigned
      const { data: entries } = await supabase
        .from("daily_schedules")
        .select("id")
        .eq("schedule_date", targetDate)
        .maybeSingle();

      let assignedEmployeeIds: string[] = [];
      if (entries) {
        const { data: schedEntries } = await supabase
          .from("daily_schedule_entries")
          .select("employee_id, project_id")
          .eq("daily_schedule_id", entries.id);
        assignedEmployeeIds = (schedEntries || []).map((e) => e.employee_id);
      }

      return employees.map((emp) => {
        const vac = vacations.find((v) => v.employee_id === emp.id);
        const activeAbsence: ActiveAbsence | null = vac
          ? {
              start_date: vac.start_date,
              end_date: vac.end_date,
              notes: vac.notes,
              absence_type: "ferias",
            }
          : null;

        const isAssigned = assignedEmployeeIds.includes(emp.id);

        let availability: EmployeeAvailability = "disponivel";
        // Trigger fn_sync_employee_vacation_status mantém employees.status
        // em sincronia com employee_vacations — então basta ler status.
        if (emp.status === "ferias") availability = "ferias";
        else if (emp.status === "licenca") availability = "licenca";
        else if (emp.status === "afastado") availability = "afastado";
        else if (activeAbsence) availability = "ferias";
        else if (isAssigned) availability = "em_projeto";

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
