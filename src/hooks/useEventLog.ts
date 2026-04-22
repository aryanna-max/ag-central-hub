import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Camada C0.4 — Auditoria de Eventos (ADR-040).
 *
 * Lista eventos de uma entidade específica em ordem cronológica decrescente.
 *
 * RLS bloqueia leitura para roles que não sejam master/diretor (exceto eventos
 * onde o próprio usuário é ator). Se o hook retornar vazio para um usuário de
 * outro role, é comportamento esperado.
 */

export interface EventLogRow {
  id: string;
  event_type: string;
  entity_table: string;
  entity_id: string;
  actor_type: "user" | "system" | "trigger" | "external";
  actor_id: string | null;
  payload: Record<string, unknown>;
  context: Record<string, unknown> | null;
  occurred_at: string;
  created_at: string;
}

export function useEventLog(entityTable: string, entityId: string | null | undefined) {
  return useQuery({
    queryKey: ["event_log", entityTable, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_log")
        .select("*")
        .eq("entity_table", entityTable)
        .eq("entity_id", entityId!)
        .order("occurred_at", { ascending: false });

      if (error) throw error;
      return (data ?? []) as EventLogRow[];
    },
  });
}

/**
 * Lista eventos por tipo — útil para telas tipo "últimas aprovações" ou
 * "últimos emails enviados". Filtro por janela de tempo é opcional.
 */
export function useEventLogByType(
  eventType: string,
  options?: { since?: string; limit?: number }
) {
  return useQuery({
    queryKey: ["event_log", "by_type", eventType, options?.since, options?.limit],
    queryFn: async () => {
      let query = supabase
        .from("event_log")
        .select("*")
        .eq("event_type", eventType)
        .order("occurred_at", { ascending: false });

      if (options?.since) {
        query = query.gte("occurred_at", options.since);
      }

      if (options?.limit) {
        query = query.limit(options.limit);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as EventLogRow[];
    },
  });
}

/**
 * RPC helper — registra evento custom do frontend autenticado.
 *
 * Exemplo:
 *   await logEvent("proposal.rejected", "proposals", proposalId, { reason: "..." });
 *
 * Para eventos de sistema (service_role), use direto a Edge Function — esta
 * RPC é só para UI autenticada.
 */
export async function logEvent(
  eventType: string,
  entityTable: string,
  entityId: string,
  payload: Record<string, unknown> = {},
  context: Record<string, unknown> | null = null
): Promise<string | null> {
  const { data, error } = await supabase.rpc("log_event", {
    p_event_type: eventType,
    p_entity_table: entityTable,
    p_entity_id: entityId,
    p_payload: payload,
    p_context: context,
  });

  if (error) {
    // Não relança — logEvent é acessório, não crítico.
    // Mas logar no console é importante para detectar problemas.
    console.error("[event_log] Falha ao registrar evento:", error, {
      eventType,
      entityTable,
      entityId,
    });
    return null;
  }

  return data as string;
}
