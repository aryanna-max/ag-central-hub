import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type MeasurementInsert = Database["public"]["Tables"]["measurements"]["Insert"];
type MeasurementUpdate = Database["public"]["Tables"]["measurements"]["Update"];
type MeasurementItemInsert = Database["public"]["Tables"]["measurement_items"]["Insert"];
type MeasurementItemUpdate = Database["public"]["Tables"]["measurement_items"]["Update"];

export interface Measurement {
  id: string;
  codigo_bm: string;
  measurement_number: number | null;
  measurement_type: string;
  project_id: string | null;
  project_service_id: string | null;
  proposal_id: string | null;
  client_id: string | null;
  invoice_id: string | null;
  period_start: string;
  period_end: string;
  dias_semana: number;
  valor_diaria_semana: number;
  dias_fds: number;
  valor_diaria_fds: number;
  retencao_pct: number;
  valor_bruto: number | null;
  valor_retencao: number | null;
  valor_nf: number | null;
  avanco_periodo_pct: number;
  avanco_acumulado_pct: number;
  saldo_a_medir: number;
  status: string;
  nf_numero: string | null;
  nf_data: string | null;
  pdf_signed_url: string | null;
  notes: string | null;
  empresa_faturadora: string;
  tipo_documento: string;
  instrucao_faturamento: string | null;
  responsavel_cobranca_id: string | null;
  approved_by_client: boolean;
  approved_at: string | null;
  requires_signature: boolean;
  created_at: string | null;
  updated_at: string | null;
  // joined
  project_name?: string;
  client_name?: string;
  proposal_code?: string;
}

export interface MeasurementItem {
  id: string;
  measurement_id: string;
  project_service_id: string | null;
  item_number: number;
  description: string;
  unit: string;
  contracted_quantity: number;
  unit_value: number;
  total_contracted: number;
  measured_quantity: number;
  measured_value: number;
  accumulated_quantity: number;
  accumulated_value: number;
  remaining_quantity: number;
  remaining_value: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MeasurementDailyEntry {
  id: string;
  measurement_id: string;
  date: string;
  employee_id: string;
  project_id: string;
  day_type: string;
  worked: boolean;
  daily_record_id: string | null;
  notes: string | null;
  created_at: string;
  employee_name?: string;
}

export function useMeasurements() {
  return useQuery({
    queryKey: ["measurements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurements")
        .select("*, projects:project_id(name), clients:client_id(name), proposals:proposal_id(code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data as any[]).map((r) => ({
        ...r,
        project_name: r.projects?.name ?? null,
        client_name: r.clients?.name ?? null,
        proposal_code: r.proposals?.code ?? null,
      })) as Measurement[];
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
      return (data as any[]).map((r) => ({
        ...r,
        project_name: r.projects?.name ?? null,
        client_name: r.clients?.name ?? null,
        proposal_code: r.proposals?.code ?? null,
      })) as Measurement[];
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
      const measurement = {
        ...mRes.data,
        project_name: (mRes.data as any).projects?.name ?? null,
        client_name: (mRes.data as any).clients?.name ?? null,
        proposal_code: (mRes.data as any).proposals?.code ?? null,
      } as Measurement & { projects?: any; clients?: any; proposals?: any };
      const items = (itemsRes.data || []) as MeasurementItem[];
      const entries = ((entriesRes.data || []) as any[]).map((e) => ({
        ...e,
        employee_name: e.employees?.name ?? null,
      })) as MeasurementDailyEntry[];
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
        const { data: prevItems } = await supabase
          .from("measurement_items")
          .select("project_service_id, accumulated_quantity, accumulated_value")
          .in(
            "measurement_id",
            (
              await supabase
                .from("measurements")
                .select("id")
                .eq("project_id", projectId)
                .neq("id", measurement.id)
            ).data?.map((m: any) => m.id) || []
          );

        const accMap = new Map<string, { qty: number; val: number }>();
        (prevItems || []).forEach((pi: any) => {
          if (!pi.project_service_id) return;
          const existing = accMap.get(pi.project_service_id);
          if (!existing || pi.accumulated_quantity > existing.qty) {
            accMap.set(pi.project_service_id, {
              qty: pi.accumulated_quantity,
              val: pi.accumulated_value,
            });
          }
        });

        const items = services.map((svc: any, idx: number) => {
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

        const itemsPayload: MeasurementItemInsert[] = items;
        await supabase.from("measurement_items").insert(itemsPayload);
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

      const totalMeasured = (items || []).reduce((s: number, i: any) => s + (i.measured_value || 0), 0);
      const totalContracted = (items || []).reduce((s: number, i: any) => s + (i.total_contracted || 0), 0);
      const totalAccumulated = (items || []).reduce((s: number, i: any) => s + (i.accumulated_value || 0), 0) + totalMeasured;

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

      for (const item of items || []) {
        const newAccQty = (item as any).accumulated_quantity + (item as any).measured_quantity;
        const newAccVal = (item as any).accumulated_value + (item as any).measured_value;
        const itemUpdate: MeasurementItemUpdate = {
          accumulated_quantity: newAccQty,
          accumulated_value: newAccVal,
          remaining_quantity: Math.max(0, (item as any).contracted_quantity - newAccQty),
          remaining_value: Math.max(0, (item as any).total_contracted - newAccVal),
        };
        await supabase
          .from("measurement_items")
          .update(itemUpdate)
          .eq("id", (item as any).id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["measurements"] });
      qc.invalidateQueries({ queryKey: ["measurement-detail"] });
    },
  });
}
