import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type MeasurementRow = Database["public"]["Tables"]["measurements"]["Row"];
type MeasurementInsert = Database["public"]["Tables"]["measurements"]["Insert"];
type MeasurementUpdate = Database["public"]["Tables"]["measurements"]["Update"];
type MeasurementItemRow = Database["public"]["Tables"]["measurement_items"]["Row"];
type MeasurementItemInsert = Database["public"]["Tables"]["measurement_items"]["Insert"];
type MeasurementItemUpdate = Database["public"]["Tables"]["measurement_items"]["Update"];
type MeasurementDailyEntryRow = Database["public"]["Tables"]["measurement_daily_entries"]["Row"];

/**
 * Measurement = linha de `measurements` (gerada) + campos derivados de joins
 * (project_name, client_name, proposal_code) calculados em queryFn.
 */
export type Measurement = MeasurementRow & {
  project_name?: string | null;
  client_name?: string | null;
  proposal_code?: string | null;
};

export type MeasurementItem = MeasurementItemRow;

export type MeasurementDailyEntry = MeasurementDailyEntryRow & {
  employee_name?: string | null;
};

/** Linha bruta retornada com joins acoplados — útil para detail view. */
type MeasurementWithRelations = MeasurementRow & {
  projects: { name: string | null; codigo?: string | null; location?: string | null; scope_description?: string | null; empresa_faturadora?: string | null; contract_value?: number | null } | null;
  clients: { name: string | null; cnpj?: string | null } | null;
  proposals: { code: string | null; title?: string | null } | null;
};

type MeasurementListRow = MeasurementRow & {
  projects: { name: string | null } | null;
  clients: { name: string | null } | null;
  proposals: { code: string | null } | null;
};

type MeasurementDailyEntryWithEmployee = MeasurementDailyEntryRow & {
  employees: { name: string | null } | null;
};

export function useMeasurements() {
  return useQuery({
    queryKey: ["measurements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurements")
        .select("*, projects:project_id(name), clients:client_id(name), proposals:proposal_id(code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as MeasurementListRow[];
      return rows.map<Measurement>((r) => ({
        ...r,
        project_name: r.projects?.name ?? null,
        client_name: r.clients?.name ?? null,
        proposal_code: r.proposals?.code ?? null,
      }));
    },
  });
}

export function useProjectMeasurements(projectId: string | null) {
  return useQuery({
    queryKey: ["measurements", "project", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("measurements")
        .select("*, projects:project_id(name), clients:client_id(name), proposals:proposal_id(code)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as MeasurementListRow[];
      return rows.map<Measurement>((r) => ({
        ...r,
        project_name: r.projects?.name ?? null,
        client_name: r.clients?.name ?? null,
        proposal_code: r.proposals?.code ?? null,
      }));
    },
    enabled: !!projectId,
  });
}

export function useMeasurementWithItems(measurementId: string | null) {
  return useQuery({
    queryKey: ["measurement-detail", measurementId],
    queryFn: async () => {
      if (!measurementId) return null;
      const [mRes, itemsRes, entriesRes] = await Promise.all([
        supabase
          .from("measurements")
          .select("*, projects:project_id(name, codigo, location, scope_description, empresa_faturadora, contract_value), clients:client_id(name, cnpj), proposals:proposal_id(code, title)")
          .eq("id", measurementId)
          .single(),
        supabase
          .from("measurement_items")
          .select("*")
          .eq("measurement_id", measurementId)
          .order("item_number"),
        supabase
          .from("measurement_daily_entries")
          .select("*, employees:employee_id(name)")
          .eq("measurement_id", measurementId)
          .order("date"),
      ]);
      if (mRes.error) throw mRes.error;
      const raw = mRes.data as unknown as MeasurementWithRelations;
      const measurement: Measurement & { projects: MeasurementWithRelations["projects"]; clients: MeasurementWithRelations["clients"]; proposals: MeasurementWithRelations["proposals"] } = {
        ...raw,
        project_name: raw.projects?.name ?? null,
        client_name: raw.clients?.name ?? null,
        proposal_code: raw.proposals?.code ?? null,
      };
      const items = (itemsRes.data ?? []) as MeasurementItem[];
      const entriesRaw = (entriesRes.data ?? []) as unknown as MeasurementDailyEntryWithEmployee[];
      const entries: MeasurementDailyEntry[] = entriesRaw.map((e) => ({
        ...e,
        employee_name: e.employees?.name ?? null,
      }));
      return { measurement, items, entries };
    },
    enabled: !!measurementId,
  });
}

export function useCreateMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: MeasurementInsert) => {
      const { data, error } = await supabase
        .from("measurements")
        .insert(values)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurements"] }),
  });
}

export function useUpdateMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...values }: MeasurementUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from("measurements")
        .update(values)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurements"] });
      qc.invalidateQueries({ queryKey: ["measurement-detail"] });
    },
  });
}

export function useDeleteMeasurement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("measurements")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["measurements"] }),
  });
}

export function useCreateMeasurementFromProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      measurementType,
      periodStart,
      periodEnd,
    }: {
      projectId: string;
      measurementType: string;
      periodStart: string;
      periodEnd: string;
    }) => {
      const { data: project, error: projErr } = await supabase
        .from("projects")
        .select("id, name, codigo, client_id, empresa_faturadora, contract_value")
        .eq("id", projectId)
        .single();
      if (projErr) throw projErr;

      const { data: proposals } = await supabase
        .from("project_services")
        .select("proposal_id")
        .eq("project_id", projectId)
        .not("proposal_id", "is", null)
        .limit(1);
      const proposalId = proposals?.[0]?.proposal_id ?? null;

      // Código BM: BM-{CODIGO_PROJETO_SEM_ANO}-{SEQ_POR_PROJETO}
      // Ex: Projeto "2026-BRK-003" → BM-BRK-003-001, BM-BRK-003-002...
      const codigoSemAno = (project.codigo ?? "")
        .replace(/^\d{4}-/, ""); // remove "2026-" do início
      const { count } = await supabase
        .from("measurements")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId);
      const seq = (count ?? 0) + 1;
      const codigoBm = `BM-${codigoSemAno}-${String(seq).padStart(2, "0")}`;

      const measurementPayload: MeasurementInsert = {
        codigo_bm: codigoBm,
        measurement_number: seq,
        measurement_type: measurementType,
        project_id: projectId,
        client_id: project.client_id,
        proposal_id: proposalId,
        period_start: periodStart,
        period_end: periodEnd,
        empresa_faturadora: project.empresa_faturadora || "ag_topografia",
        status: "rascunho",
      };
      const { data: measurement, error: mErr } = await supabase
        .from("measurements")
        .insert(measurementPayload)
        .select()
        .single();
      if (mErr) throw mErr;

      const { data: services } = await supabase
        .from("project_services")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at");

      if (services && services.length > 0) {
        const { data: prevMeasurements } = await supabase
          .from("measurements")
          .select("id")
          .eq("project_id", projectId)
          .neq("id", measurement.id);
        const prevIds = (prevMeasurements ?? []).map((m) => m.id);
        const { data: prevItems } = await supabase
          .from("measurement_items")
          .select("project_service_id, accumulated_quantity, accumulated_value")
          .in("measurement_id", prevIds);

        const accMap = new Map<string, { qty: number; val: number }>();
        (prevItems ?? []).forEach((pi) => {
          if (!pi.project_service_id) return;
          const existing = accMap.get(pi.project_service_id);
          const piQty = pi.accumulated_quantity ?? 0;
          if (!existing || piQty > existing.qty) {
            accMap.set(pi.project_service_id, {
              qty: piQty,
              val: pi.accumulated_value ?? 0,
            });
          }
        });

        const items: MeasurementItemInsert[] = services.map((svc, idx) => {
          const prev = accMap.get(svc.id);
          const contractedQty = 1;
          const unitVal = svc.contract_value || svc.daily_rate || svc.monthly_rate || 0;
          const totalContracted = contractedQty * unitVal;
          const remainQty = contractedQty - (prev?.qty || 0);
          const remainVal = totalContracted - (prev?.val || 0);
          return {
            measurement_id: measurement.id,
            project_service_id: svc.id,
            item_number: idx + 1,
            description: svc.scope_description || svc.service_type,
            unit: svc.billing_mode === "diarias" ? "diaria" : svc.billing_mode === "fixo_mensal" ? "mes" : "servico",
            contracted_quantity: contractedQty,
            unit_value: unitVal,
            total_contracted: totalContracted,
            measured_quantity: 0,
            measured_value: 0,
            accumulated_quantity: prev?.qty || 0,
            accumulated_value: prev?.val || 0,
            remaining_quantity: Math.max(0, remainQty),
            remaining_value: Math.max(0, remainVal),
          };
        });

        await supabase.from("measurement_items").insert(items);
      }

      return measurement;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurements"] });
      qc.invalidateQueries({ queryKey: ["measurement-detail"] });
    },
  });
}

export function useCalculateMeasurementTotals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (measurementId: string) => {
      const { data: measurement } = await supabase
        .from("measurements")
        .select("id, project_id")
        .eq("id", measurementId)
        .single();
      if (!measurement) throw new Error("Medição não encontrada");

      const { data: items } = await supabase
        .from("measurement_items")
        .select("*")
        .eq("measurement_id", measurementId);

      const itemRows = (items ?? []) as MeasurementItemRow[];
      const totalMeasured = itemRows.reduce((s, i) => s + (i.measured_value || 0), 0);
      const totalContracted = itemRows.reduce((s, i) => s + (i.total_contracted || 0), 0);
      const totalAccumulated = itemRows.reduce((s, i) => s + (i.accumulated_value || 0), 0) + totalMeasured;

      const avancoPeriodo = totalContracted > 0 ? (totalMeasured / totalContracted) * 100 : 0;
      const avancoAcumulado = totalContracted > 0 ? (totalAccumulated / totalContracted) * 100 : 0;
      const saldo = totalContracted - totalAccumulated;

      const measurementUpdate: MeasurementUpdate = {
        valor_bruto: totalMeasured,
        avanco_periodo_pct: Math.round(avancoPeriodo * 100) / 100,
        avanco_acumulado_pct: Math.round(avancoAcumulado * 100) / 100,
        saldo_a_medir: Math.max(0, saldo),
      };
      await supabase
        .from("measurements")
        .update(measurementUpdate)
        .eq("id", measurementId);

      for (const item of itemRows) {
        const accQty = item.accumulated_quantity ?? 0;
        const accVal = item.accumulated_value ?? 0;
        const measQty = item.measured_quantity ?? 0;
        const measVal = item.measured_value ?? 0;
        const newAccQty = accQty + measQty;
        const newAccVal = accVal + measVal;
        const itemUpdate: MeasurementItemUpdate = {
          accumulated_quantity: newAccQty,
          accumulated_value: newAccVal,
          remaining_quantity: Math.max(0, (item.contracted_quantity ?? 0) - newAccQty),
          remaining_value: Math.max(0, (item.total_contracted ?? 0) - newAccVal),
        };
        await supabase
          .from("measurement_items")
          .update(itemUpdate)
          .eq("id", item.id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurements"] });
      qc.invalidateQueries({ queryKey: ["measurement-detail"] });
    },
  });
}
