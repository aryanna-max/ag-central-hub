import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInDays, parseISO } from "date-fns";

export const DOC_TYPE_LABELS: Record<string, string> = {
  aso: "ASO",
  nr18: "NR-18",
  nr35: "NR-35",
  nr10: "NR-10",
  nr33: "NR-33",
  ficha_epi: "Ficha EPI",
  integracao: "Integração Cliente",
  ctps: "CTPS",
  rg: "RG",
  cpf: "CPF",
  cnh: "CNH",
  comprovante_residencia: "Comp. Residência",
  certidao_nascimento: "Certidão Nascimento",
  titulo_eleitor: "Título Eleitor",
  reservista: "Reservista",
  pis: "PIS",
  conta_bancaria: "Conta Bancária",
  foto_3x4: "Foto 3x4",
  crea: "CREA",
  contrato_trabalho: "Contrato Trabalho",
  outro: "Outro",
};

const DOCS_COM_VALIDADE = ["aso", "nr18", "nr35", "nr10", "nr33", "integracao", "cnh", "crea"];

export function calcDocStatus(doc_type: string, expiry_date: string | null): string {
  if (!expiry_date || !DOCS_COM_VALIDADE.includes(doc_type)) return "valido";
  const days = differenceInDays(parseISO(expiry_date), new Date());
  if (days < 0) return "vencido";
  if (days <= 30) return "proximo_vencer";
  return "valido";
}

export function useEmployeeDocuments(employeeId: string | undefined) {
  return useQuery({
    queryKey: ["employee-documents", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*")
        .eq("employee_id", employeeId)
        .order("doc_type");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!employeeId,
  });
}

export function useCriticalDocuments() {
  return useQuery({
    queryKey: ["critical-documents"],
    queryFn: async () => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() + 30);
      const cutoffStr = cutoff.toISOString().split("T")[0];
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*, employees(name, matricula)")
        .not("expiry_date", "is", null)
        .lte("expiry_date", cutoffStr)
        .order("expiry_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60000,
  });
}

export function useEmployeeComplianceCheck(employeeId: string | undefined, clientId: string | undefined) {
  return useQuery({
    queryKey: ["compliance-check", employeeId, clientId],
    queryFn: async () => {
      if (!employeeId || !clientId) return { ok: true, missing: [] };

      const [{ data: requirements }, { data: docs }] = await Promise.all([
        supabase.from("client_doc_requirements").select("doc_type, is_mandatory").eq("client_id", clientId).eq("is_mandatory", true),
        // doc_status enum em types.ts ("vencendo") difere do valor real usado pela app ("proximo_vencer"); types.ts pendente de regen
        supabase.from("employee_documents").select("doc_type, doc_status").eq("employee_id", employeeId).in("doc_status", ["valido", "proximo_vencer"] as any),
      ]);

      const employeeDocTypes = new Set((docs ?? []).map((d) => d.doc_type));
      const missing = (requirements ?? []).filter((r) => !employeeDocTypes.has(r.doc_type));
      return { ok: missing.length === 0, missing };
    },
    enabled: !!employeeId && !!clientId,
  });
}

export function useUpsertEmployeeDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: {
      id?: string;
      employee_id: string;
      doc_type: string;
      issue_date?: string | null;
      expiry_date?: string | null;
      file_url?: string | null;
      notes?: string | null;
    }) => {
      const doc_status = calcDocStatus(values.doc_type, values.expiry_date ?? null);
      const payload = { ...values, doc_status };

      if (values.id) {
        // doc_type/doc_status enums divergentes entre types.ts e DB real (regen pendente)
        const { error } = await supabase.from("employee_documents").update(payload as any).eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employee_documents").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["employee-documents", vars.employee_id] });
      qc.invalidateQueries({ queryKey: ["critical-documents"] });
    },
  });
}

export function useDeleteEmployeeDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; employeeId: string }) => {
      const { error } = await supabase.from("employee_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ["employee-documents", vars.employeeId] });
      qc.invalidateQueries({ queryKey: ["critical-documents"] });
    },
  });
}
