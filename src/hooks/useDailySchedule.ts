import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { syncDailyToMonthly } from "./useMonthlySchedules";

type AttendanceStatus = Database["public"]["Enums"]["attendance_status"];

export function useDailySchedule(date: string) {
  return useQuery({
    queryKey: ["daily-schedule", date],
    queryFn: async () => {
      const { data: schedule, error } = await supabase
        .from("daily_schedules")
        .select("*")
        .eq("schedule_date", date)
        .eq("is_legacy", false)
        .maybeSingle();
      if (error) throw error;
      if (!schedule) return null;

      const { data: assignments, error: assErr } = await supabase
        .from("daily_team_assignments")
        .select("*, teams(*, team_members(*, employees(*))), projects:project_id(id, name, location), vehicles(*)")
        .eq("daily_schedule_id", schedule.id);
      if (assErr) throw assErr;

      const { data: entries, error: entError } = await supabase
        .from("daily_schedule_entries")
        .select("*, employees(*)")
        .eq("daily_schedule_id", schedule.id);
      if (entError) throw entError;

      return { ...schedule, assignments: assignments || [], entries: entries || [] };
    },
  });
}

export function useCreateDailySchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (date: string) => {
      const { data, error } = await supabase
        .from("daily_schedules")
        .insert({ schedule_date: date })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, date) => qc.invalidateQueries({ queryKey: ["daily-schedule", date] }),
  });
}

export function useAddTeamAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (assignment: {
      daily_schedule_id: string;
      team_id: string;
      project_id?: string;
      vehicle_id?: string;
      notes?: string;
      date?: string;
    }) => {
      const { date, ...rest } = assignment;
      const insertPayload: any = { ...rest };
      
      const { data, error } = await supabase
        .from("daily_team_assignments")
        .insert(insertPayload)
        .select()
        .single();
      if (error) throw error;

      if (date && assignment.project_id) {
        await syncDailyToMonthly(date, assignment.team_id, {
          project_id: assignment.project_id,
          vehicle_id: assignment.vehicle_id || null,
        });

        // Auto-transição: aguardando_campo → em_campo ao alocar na escala
        const { data: proj } = await supabase
          .from("projects")
          .select("execution_status")
          .eq("id", assignment.project_id)
          .single();
        if (proj?.execution_status === "aguardando_campo") {
          await supabase.from("projects").update({
            execution_status: "em_campo" as any,
            field_started_at: date,
          }).eq("id", assignment.project_id);
          await supabase.from("project_status_history").insert({
            project_id: assignment.project_id,
            from_status: "aguardando_campo",
            to_status: "em_campo",
            modulo: "operacional",
            notes: "Auto: alocado na escala diária",
          });
        }
      }

      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
      qc.invalidateQueries({ queryKey: ["monthly-schedules"] });
    },
  });
}

export function useUpdateTeamAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
      date,
      teamId,
    }: {
      id: string;
      updates: { project_id?: string; vehicle_id?: string; notes?: string };
      date?: string;
      teamId?: string;
    }) => {
      const dbUpdates: any = { ...updates };

      const { error } = await supabase
        .from("daily_team_assignments")
        .update(dbUpdates)
        .eq("id", id);
      if (error) throw error;

      if (date && teamId) {
        await syncDailyToMonthly(date, teamId, {
          project_id: updates.project_id,
          vehicle_id: updates.vehicle_id || null,
        });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
      qc.invalidateQueries({ queryKey: ["monthly-schedules"] });
    },
  });
}

export function useRemoveTeamAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("daily_team_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
      qc.invalidateQueries({ queryKey: ["monthly-schedules"] });
    },
  });
}

export function useAddDailyEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      daily_schedule_id: string;
      employee_id: string;
      team_id?: string;
      project_id?: string;
      vehicle_id?: string;
      daily_team_assignment_id?: string;
    }) => {
      const insertPayload: any = { ...entry };

      const { data, error } = await supabase
        .from("daily_schedule_entries")
        .insert(insertPayload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-schedule"] }),
  });
}

export function useUpdateAttendance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      entryId,
      attendance,
      check_in_time,
      check_out_time,
      absence_reason,
    }: {
      entryId: string;
      attendance: AttendanceStatus;
      check_in_time?: string;
      check_out_time?: string;
      absence_reason?: string;
    }) => {
      const update: Record<string, unknown> = { attendance };
      if (check_in_time) update.check_in_time = check_in_time;
      if (check_out_time) update.check_out_time = check_out_time;
      if (absence_reason) update.absence_reason = absence_reason;

      const { error } = await supabase
        .from("daily_schedule_entries")
        .update(update)
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-schedule"] }),
  });
}

export function useCloseDailySchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (scheduleId: string) => {
      // 1. Fechar a escala
      const { error } = await supabase
        .from("daily_schedules")
        .update({ is_closed: true, closed_at: new Date().toISOString() })
        .eq("id", scheduleId);
      if (error) throw error;

      // 2. Buscar a data da escala e os assignments com veículos
      const { data: schedule } = await supabase
        .from("daily_schedules")
        .select("schedule_date")
        .eq("id", scheduleId)
        .single();
      if (!schedule) return;

      const { data: assignments } = await supabase
        .from("daily_team_assignments")
        .select("vehicle_id")
        .eq("daily_schedule_id", scheduleId)
        .not("vehicle_id", "is", null);

      // 3. Para cada veículo, gerar diária automática (só se houver veículos)
      if (assignments?.length) {
        const d = new Date(schedule.schedule_date + "T12:00:00");
        const month = d.getMonth() + 1;
        const year = d.getFullYear();
        const vehicleIds = [...new Set(assignments.map((a) => a.vehicle_id).filter(Boolean))] as string[];

        for (const vehicleId of vehicleIds) {
          // Buscar daily_rate do veículo
          const { data: vehicle } = await supabase
            .from("vehicles")
            .select("daily_rate")
            .eq("id", vehicleId)
            .single();
          const dailyRate = vehicle?.daily_rate || 0;

          // Verificar se já existe registro pro mês
          const { data: existing } = await supabase
            .from("vehicle_payment_history")
            .select("id, days_count")
            .eq("vehicle_id", vehicleId)
            .eq("month", month)
            .eq("year", year)
            .maybeSingle();

          if (existing) {
            const newCount = (existing.days_count || 0) + 1;
            await supabase
              .from("vehicle_payment_history")
              .update({
                days_count: newCount,
                daily_rate: dailyRate,
                total_value: newCount * dailyRate,
              })
              .eq("id", existing.id);
          } else {
            await supabase
              .from("vehicle_payment_history")
              .insert({
                vehicle_id: vehicleId,
                month,
                year,
                days_count: 1,
                daily_rate: dailyRate,
                total_value: dailyRate,
                status: "aberto",
                period_start: schedule.schedule_date,
                period_end: schedule.schedule_date,
              } as any);
          }
        }
      }

      // === GERAR EMPLOYEE_DAILY_RECORDS ===
      const { data: entries } = await supabase
        .from("daily_schedule_entries")
        .select("employee_id, project_id, attendance, vehicle_id, employees:employee_id(transporte_tipo)")
        .eq("daily_schedule_id", scheduleId)
        .is("removed_at", null);

      // Configuração VT do system_settings (default 4.50 × 2 viagens = 9.00/dia)
      const { data: vtConfigData } = await supabase
        .from("system_settings")
        .select("key, value")
        .in("key", ["vt_valor_viagem", "vt_viagens_por_dia"]);
      const settingsMap = new Map((vtConfigData || []).map((s: any) => [s.key, s.value]));
      const vtValorViagem = parseFloat(settingsMap.get("vt_valor_viagem") || "4.50");
      const vtViagensDia = parseInt(settingsMap.get("vt_viagens_por_dia") || "2", 10);
      const vtDiario = vtValorViagem * vtViagensDia;

      if (entries?.length) {
        const projectIds = [...new Set(entries.map(e => e.project_id).filter(Boolean))] as string[];
        const { data: allBenefits } = await supabase
          .from("project_benefits")
          .select("*")
          .in("project_id", projectIds);

        const benefitsMap = new Map(
          (allBenefits || []).map(b => [b.project_id, b])
        );

        for (const entry of entries) {
          const benefits = entry.project_id ? benefitsMap.get(entry.project_id) : null;
          const isPresente = !entry.attendance || entry.attendance === "presente" || entry.attendance === "atrasado";
          const transporteTipo = entry.employees?.transporte_tipo || "vt_cartao";
          const recebeVt = isPresente && transporteTipo === "vt_cartao";

          const record = {
            employee_id: entry.employee_id,
            schedule_date: schedule.schedule_date,
            project_id: entry.project_id,
            daily_schedule_id: scheduleId,
            attendance: entry.attendance || "presente",
            vehicle_id: entry.vehicle_id,
            cafe_provided: isPresente && (benefits?.cafe_enabled || false),
            cafe_value: isPresente && benefits?.cafe_enabled ? (benefits.cafe_value || 0) : 0,
            almoco_dif_provided: isPresente && (benefits?.almoco_type as string) === "diferenca",
            almoco_dif_value: isPresente && (benefits?.almoco_type as string) === "diferenca" ? (benefits?.almoco_diferenca_value || 0) : 0,
            jantar_provided: isPresente && (benefits?.jantar_enabled || false),
            jantar_value: isPresente && benefits?.jantar_enabled ? (benefits.jantar_value || 0) : 0,
            hospedagem_provided: isPresente && (benefits?.hospedagem_enabled || false),
            hospedagem_value: isPresente && benefits?.hospedagem_enabled ? (benefits.hospedagem_value || 0) : 0,
            vt_provided: recebeVt,
            vt_value: recebeVt ? vtDiario : 0,
            status: "provisorio",
          };

          // Upsert: se já existe (re-fechar), atualiza
          let upsertQuery = supabase.from("employee_daily_records")
            .select("id")
            .eq("employee_id", entry.employee_id)
            .eq("schedule_date", schedule.schedule_date);
          if (entry.project_id) {
            upsertQuery = upsertQuery.eq("project_id", entry.project_id);
          } else {
            upsertQuery = upsertQuery.is("project_id", null);
          }
          const { data: existingRecord } = await upsertQuery.maybeSingle();

          if (existingRecord) {
            await supabase.from("employee_daily_records").update(record).eq("id", existingRecord.id);
          } else {
            await supabase.from("employee_daily_records").insert(record);
          }
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-schedule"] });
      qc.invalidateQueries({ queryKey: ["vehicle-payments"] });
      qc.invalidateQueries({ queryKey: ["employee-daily-records"] });
    },
  });
}

export function useRemoveDailyEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entryId: string) => {
      const { error } = await supabase
        .from("daily_schedule_entries")
        .delete()
        .eq("id", entryId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-schedule"] }),
  });
}

/** Pre-fill daily schedule from monthly schedule */
export function usePreFillFromMonthly() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ scheduleId, date }: { scheduleId: string; date: string }) => {
      const d = new Date(date + "T12:00:00");
      const dayOfWeek = d.getDay();

      const { data: monthly, error: mErr } = await supabase
        .from("monthly_schedules")
        .select("*, teams(*, team_members(*, employees(*)))")
        .lte("start_date", date)
        .gte("end_date", date);
      if (mErr) throw mErr;

      if (!monthly?.length) return;

      for (const ms of monthly) {
        if ((ms.schedule_type || "mensal") === "mensal" && (dayOfWeek === 0 || dayOfWeek === 6)) {
          continue;
        }

        const projectId = ms.project_id;

        const { error } = await supabase
          .from("daily_team_assignments")
          .insert({
            daily_schedule_id: scheduleId,
            team_id: ms.team_id,
            project_id: projectId,
            vehicle_id: ms.vehicle_id,
          });
        if (error && !error.message.includes("duplicate")) throw error;
        if (error && error.message.includes("duplicate")) {
          console.warn("Entrada duplicada ignorada (assignment):", ms.team_id);
        }

        const members = (ms as any).teams?.team_members || [];
        for (const member of members) {
          const { error: entErr } = await supabase
            .from("daily_schedule_entries")
            .insert({
              daily_schedule_id: scheduleId,
              employee_id: member.employee_id,
              team_id: ms.team_id,
              vehicle_id: ms.vehicle_id,
            });
          if (entErr && !entErr.message.includes("duplicate")) throw entErr;
          if (entErr && entErr.message.includes("duplicate")) {
            console.warn("Entrada duplicada ignorada:", member.employee_id);
          }
        }
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["daily-schedule"] }),
  });
}
