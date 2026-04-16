import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MeasurementDailyEntry } from "./useMeasurements";

export function useMeasurementDailyEntries(measurementId: string | null) {
  return useQuery({
    queryKey: ["measurement-daily-entries", measurementId],
    queryFn: async () => {
      if (!measurementId) return [];
      const { data, error } = await supabase
        .from("measurement_daily_entries")
        .select("*, employees:employee_id(name)")
        .eq("measurement_id", measurementId)
        .order("date");
      if (error) throw error;
      return (data as any[]).map((e) => ({
        ...e,
        employee_name: e.employees?.name ?? null,
      })) as MeasurementDailyEntry[];
    },
    enabled: !!measurementId,
  });
}

export function useFieldControlGrid(projectId: string | null, month: number, year: number) {
  return useQuery({
    queryKey: ["field-control-grid", projectId, month, year],
    queryFn: async () => {
      if (!projectId) return { entries: [], employees: [] };

      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const { data: records, error: recErr } = await supabase
        .from("employee_daily_records")
        .select("*, employees:employee_id(name, matricula)")
        .eq("project_id", projectId)
        .gte("schedule_date", startDate)
        .lte("schedule_date", endDate)
        .order("schedule_date");

      if (recErr) {
        const { data: scheduleEntries, error: seErr } = await supabase
          .from("daily_schedule_entries")
          .select("*, employees:employee_id(name, matricula), daily_schedules!inner(schedule_date)")
          .eq("project_id", projectId)
          .not("attendance", "eq", "falta")
          .order("created_at");
        if (seErr) throw seErr;

        const filtered = (scheduleEntries as any[]).filter((e) => {
          const d = e.daily_schedules?.schedule_date;
          return d && d >= startDate && d <= endDate;
        });

        const empMap = new Map<string, { id: string; name: string; matricula: string }>();
        const entries = filtered.map((e) => {
          if (!empMap.has(e.employee_id)) {
            empMap.set(e.employee_id, {
              id: e.employee_id,
              name: e.employees?.name ?? "—",
              matricula: e.employees?.matricula ?? "",
            });
          }
          const date = e.daily_schedules?.schedule_date;
          const dow = new Date(date + "T12:00:00").getDay();
          let dayType = "normal";
          if (dow === 6) dayType = "sabado";
          if (dow === 0) dayType = "domingo";
          return {
            employee_id: e.employee_id,
            date,
            day_type: dayType,
            worked: true,
          };
        });
        return { entries, employees: Array.from(empMap.values()) };
      }

      const empMap = new Map<string, { id: string; name: string; matricula: string }>();
      const entries = (records || []).map((r: any) => {
        if (!empMap.has(r.employee_id)) {
          empMap.set(r.employee_id, {
            id: r.employee_id,
            name: r.employees?.name ?? "—",
            matricula: r.employees?.matricula ?? "",
          });
        }
        const dow = new Date(r.schedule_date + "T12:00:00").getDay();
        let dayType = "normal";
        if (dow === 6) dayType = "sabado";
        if (dow === 0) dayType = "domingo";
        return {
          employee_id: r.employee_id,
          date: r.schedule_date,
          day_type: dayType,
          worked: r.attendance !== "falta",
          daily_record_id: r.id,
        };
      });
      return { entries, employees: Array.from(empMap.values()) };
    },
    enabled: !!projectId && month > 0 && year > 0,
  });
}

export function usePopulateMeasurementDays() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      measurementId,
      projectId,
      month,
      year,
    }: {
      measurementId: string;
      projectId: string;
      month: number;
      year: number;
    }) => {
      const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

      const { data: records } = await supabase
        .from("employee_daily_records")
        .select("id, employee_id, schedule_date, attendance")
        .eq("project_id", projectId)
        .gte("schedule_date", startDate)
        .lte("schedule_date", endDate);

      if (!records || records.length === 0) return [];

      const entries = records
        .filter((r: any) => r.attendance !== "falta")
        .map((r: any) => {
          const dow = new Date(r.schedule_date + "T12:00:00").getDay();
          let dayType = "normal";
          if (dow === 6) dayType = "sabado";
          if (dow === 0) dayType = "domingo";
          return {
            measurement_id: measurementId,
            date: r.schedule_date,
            employee_id: r.employee_id,
            project_id: projectId,
            day_type: dayType,
            worked: true,
            daily_record_id: r.id,
          };
        });

      if (entries.length > 0) {
        const { error } = await supabase
          .from("measurement_daily_entries")
          .upsert(entries as any, { onConflict: "measurement_id,date,employee_id" });
        if (error) throw error;
      }
      return entries;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurement-daily-entries"] });
      qc.invalidateQueries({ queryKey: ["measurement-detail"] });
    },
  });
}
