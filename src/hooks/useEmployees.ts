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

export type AbsenceType =
  | "ferias"
  | "licenca_medica"
  | "licenca_maternidade"
  | "licenca_paternidade"
  | "afastamento"
  | "falta"
  | "outros";

export type ActiveAbsence = {
  start_date: string;
  end_date: string;
  notes: string | null;
  absence_type: AbsenceType;
};

export type EmployeeWithAvailability = Employee & {
  availability: EmployeeAvailability;
  activeAbsence: ActiveAbsence | null;
};

function availabilityFromAbsenceType(type: AbsenceType): EmployeeAvailability {
  if (type === "ferias") return "ferias";
  if (type === "afastamento") return "afastado";
  return "licenca";
}


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

      // Fonte única: employee_absences (migration #79 — unifica férias,
      // licenças e afastamentos). employee_vacations é fallback legado.
      const { data: absencesData } = await supabase
        .from("employee_absences")
        .select("employee_id, start_date, end_date, notes, absence_type, status")
        .lte("start_date", targetDate)
        .gte("end_date", targetDate)
        .neq("status", "cancelada");

      const absences = absencesData ?? [];

      let legacyVacations: { employee_id: string; start_date: string; end_date: string; notes: string | null }[] = [];
      if (absences.length === 0) {
        const { data: vacationsData } = await supabase
          .from("employee_vacations")
          .select("employee_id, start_date, end_date, notes")
          .lte("start_date", targetDate)
          .gte("end_date", targetDate);
        legacyVacations = vacationsData ?? [];
      }

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
        const abs = absences.find((a) => a.employee_id === emp.id);
        const vac = legacyVacations.find((v) => v.employee_id === emp.id);
        const activeAbsence: ActiveAbsence | null = abs
          ? {
              start_date: abs.start_date,
              end_date: abs.end_date,
              notes: abs.notes,
              absence_type: abs.absence_type as AbsenceType,
            }
          : vac
            ? {
                start_date: vac.start_date,
                end_date: vac.end_date,
                notes: vac.notes,
                absence_type: "ferias",
              }
            : null;

        const isAssigned = assignedEmployeeIds.includes(emp.id);

        let availability: EmployeeAvailability = "disponivel";
        if (activeAbsence) availability = availabilityFromAbsenceType(activeAbsence.absence_type);
        else if (emp.status === "ferias") availability = "ferias";
        else if (emp.status === "licenca") availability = "licenca";
        else if (emp.status === "afastado") availability = "afastado";
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
