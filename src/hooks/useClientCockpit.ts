import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { Client } from "@/hooks/useClients";

export type ClientHealthSign = "vermelho" | "amarelo" | "verde";

export type ClientCockpitSignalType =
  | "nf_vencida"
  | "projeto_sem_nf"
  | "nf_vencendo"
  | "sem_atividade"
  | "alerta_urgente"
  | "compliance_vencido"
  | "proposta_sem_resposta"
  | "em_dia";

export interface ClientCockpitSignal {
  type: ClientCockpitSignalType;
  severity: ClientHealthSign;
  message: string;
  count?: number;
  value?: number;
  suggestion?: string;
}

export interface ClientCockpitKpis {
  projetosAtivos: number;
  aReceber: number;
  alertas: number;
  ultimaAtividade: string | null;
}

export interface ClientCockpitRow {
  client: Client;
  kpis: ClientCockpitKpis;
  signals: ClientCockpitSignal[];
  semaforo: ClientHealthSign;
  comercialResponsavel: string | null;
  comercialResponsavelId: string | null;
  segmento: string | null;
  cnpjPrincipal: string | null;
  billingDominante: string | null;
}

const PROPOSTA_SEM_RESPOSTA_DIAS = 14;
const SEM_ATIVIDADE_DIAS = 30;
const NF_VENCIDA_DIAS = 30;
const NF_VENCENDO_DIAS = 15;
const PROJETO_SEM_NF_DIAS = 7;
const PROJETO_SEM_NF_VALOR_CRITICO = 20_000;

type ProjectRow = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  | "id"
  | "client_id"
  | "codigo"
  | "name"
  | "execution_status"
  | "billing_type"
  | "contract_value"
  | "delivery_deadline"
  | "responsible_comercial_id"
  | "updated_at"
  | "created_at"
  | "delivered_at"
  | "nf_data"
  | "is_active"
>;

type InvoiceRow = Pick<
  Database["public"]["Tables"]["invoices"]["Row"],
  "id" | "project_id" | "status" | "valor_liquido" | "nf_data" | "updated_at"
>;

type AlertRow = Pick<
  Database["public"]["Tables"]["alerts"]["Row"],
  "id" | "reference_id" | "reference_type" | "priority" | "resolved" | "created_at"
>;

type ProposalRow = Pick<
  Database["public"]["Tables"]["proposals"]["Row"],
  "id" | "client_id" | "status" | "sent_at" | "created_at" | "updated_at"
>;

type LeadInteractionRow = Pick<
  Database["public"]["Tables"]["lead_interactions"]["Row"],
  "lead_id" | "created_at"
>;

type LeadRow = Pick<
  Database["public"]["Tables"]["leads"]["Row"],
  "id" | "client_id"
>;

type IntegrationRow = Pick<
  Database["public"]["Tables"]["employee_client_integrations"]["Row"],
  "id" | "client_id" | "status" | "expiry_date"
>;

type ClientRow = Database["public"]["Tables"]["clients"]["Row"];

type ProfileRow = Pick<
  Database["public"]["Tables"]["profiles"]["Row"],
  "id" | "full_name"
>;

const TERMINAL_PROJECT_STATUSES = new Set(["pago"]);

function maxIso(...values: Array<string | null | undefined>): string | null {
  let best: string | null = null;
  for (const v of values) {
    if (!v) continue;
    if (!best || v > best) best = v;
  }
  return best;
}

function classifySemaforo(signals: ClientCockpitSignal[]): ClientHealthSign {
  if (signals.some((s) => s.severity === "vermelho")) return "vermelho";
  if (signals.some((s) => s.severity === "amarelo")) return "amarelo";
  return "verde";
}

function severityRank(s: ClientHealthSign): number {
  if (s === "vermelho") return 0;
  if (s === "amarelo") return 1;
  return 2;
}

export function useClientCockpit() {
  return useQuery<ClientCockpitRow[]>({
    queryKey: ["client-cockpit"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString().slice(0, 10);

      const [
        clientsRes,
        projectsRes,
        invoicesRes,
        alertsRes,
        proposalsRes,
        leadInteractionsRes,
        leadsRes,
        integrationsRes,
        profilesRes,
      ] = await Promise.all([
        supabase
          .from("clients")
          .select("*")
          .order("name", { ascending: true }),
        supabase
          .from("projects")
          .select(
            "id, client_id, codigo, name, execution_status, billing_type, contract_value, delivery_deadline, responsible_comercial_id, updated_at, created_at, delivered_at, nf_data, is_active",
          )
          .eq("is_active", true),
        supabase
          .from("invoices")
          .select("id, project_id, status, valor_liquido, nf_data, updated_at"),
        supabase
          .from("alerts")
          .select("id, reference_id, reference_type, priority, resolved, created_at")
          .eq("resolved", false),
        supabase
          .from("proposals")
          .select("id, client_id, status, sent_at, created_at, updated_at"),
        supabase.from("lead_interactions").select("lead_id, created_at"),
        supabase.from("leads").select("id, client_id"),
        supabase
          .from("employee_client_integrations")
          .select("id, client_id, status, expiry_date"),
        supabase.from("profiles").select("id, full_name"),
      ]);

      if (clientsRes.error) throw clientsRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;
      if (alertsRes.error) throw alertsRes.error;
      if (proposalsRes.error) throw proposalsRes.error;
      if (leadInteractionsRes.error) throw leadInteractionsRes.error;
      if (leadsRes.error) throw leadsRes.error;
      if (integrationsRes.error) throw integrationsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      const clients = (clientsRes.data ?? []) as ClientRow[];
      const projects = (projectsRes.data ?? []) as ProjectRow[];
      const invoices = (invoicesRes.data ?? []) as InvoiceRow[];
      const alerts = (alertsRes.data ?? []) as AlertRow[];
      const proposals = (proposalsRes.data ?? []) as ProposalRow[];
      const leadInteractions = (leadInteractionsRes.data ?? []) as LeadInteractionRow[];
      const leads = (leadsRes.data ?? []) as LeadRow[];
      const integrations = (integrationsRes.data ?? []) as IntegrationRow[];
      const profiles = (profilesRes.data ?? []) as ProfileRow[];

      const profileNameById = new Map(
        profiles.map((p) => [p.id, p.full_name ?? null]),
      );

      const leadClientByLead = new Map<string, string | null>();
      for (const l of leads) leadClientByLead.set(l.id, l.client_id ?? null);

      // Group projects by client
      const projectsByClient = new Map<string, ProjectRow[]>();
      const projectIdToClient = new Map<string, string>();
      for (const p of projects) {
        if (!p.client_id) continue;
        projectIdToClient.set(p.id, p.client_id);
        const arr = projectsByClient.get(p.client_id) ?? [];
        arr.push(p);
        projectsByClient.set(p.client_id, arr);
      }

      // Group invoices by client (via project_id)
      const invoicesByClient = new Map<string, InvoiceRow[]>();
      for (const inv of invoices) {
        const cId = projectIdToClient.get(inv.project_id);
        if (!cId) continue;
        const arr = invoicesByClient.get(cId) ?? [];
        arr.push(inv);
        invoicesByClient.set(cId, arr);
      }

      // Alerts by client (via reference_id matching project.id)
      const alertsByClient = new Map<string, AlertRow[]>();
      for (const a of alerts) {
        if (!a.reference_id) continue;
        const cId = projectIdToClient.get(a.reference_id);
        if (!cId) continue;
        const arr = alertsByClient.get(cId) ?? [];
        arr.push(a);
        alertsByClient.set(cId, arr);
      }

      // Proposals by client
      const proposalsByClient = new Map<string, ProposalRow[]>();
      for (const pr of proposals) {
        if (!pr.client_id) continue;
        const arr = proposalsByClient.get(pr.client_id) ?? [];
        arr.push(pr);
        proposalsByClient.set(pr.client_id, arr);
      }

      // Lead interactions by client (via leads.client_id)
      const leadInteractionsByClient = new Map<string, LeadInteractionRow[]>();
      for (const li of leadInteractions) {
        const cId = leadClientByLead.get(li.lead_id);
        if (!cId) continue;
        const arr = leadInteractionsByClient.get(cId) ?? [];
        arr.push(li);
        leadInteractionsByClient.set(cId, arr);
      }

      // Integrations by client
      const integrationsByClient = new Map<string, IntegrationRow[]>();
      for (const i of integrations) {
        if (!i.client_id) continue;
        const arr = integrationsByClient.get(i.client_id) ?? [];
        arr.push(i);
        integrationsByClient.set(i.client_id, arr);
      }

      const rows: ClientCockpitRow[] = clients
        .filter((c) => c.is_active)
        .map((c) => {
          const cProjects = projectsByClient.get(c.id) ?? [];
          const cInvoices = invoicesByClient.get(c.id) ?? [];
          const cAlerts = alertsByClient.get(c.id) ?? [];
          const cProposals = proposalsByClient.get(c.id) ?? [];
          const cInteractions = leadInteractionsByClient.get(c.id) ?? [];
          const cIntegrations = integrationsByClient.get(c.id) ?? [];

          const projetosAtivos = cProjects.filter(
            (p) => p.execution_status && !TERMINAL_PROJECT_STATUSES.has(p.execution_status),
          ).length;

          const aReceber = cProjects
            .filter(
              (p) =>
                p.execution_status === "entregue" &&
                p.billing_type !== null &&
                ["entrega_nf", "entrega_recibo"].includes(p.billing_type ?? ""),
            )
            .reduce((sum, p) => sum + Number(p.contract_value ?? 0), 0);

          const ultimaAtividade = maxIso(
            ...cProjects.map((p) => p.updated_at ?? p.created_at ?? null),
            ...cInvoices.map((inv) => inv.updated_at ?? inv.nf_data ?? null),
            ...cInteractions.map((li) => li.created_at ?? null),
            ...cAlerts.map((a) => a.created_at ?? null),
            ...cProposals.map(
              (pr) => pr.updated_at ?? pr.sent_at ?? pr.created_at ?? null,
            ),
          );

          // ── Signals ─────────────────────────────────────────────────────────
          const signals: ClientCockpitSignal[] = [];

          // Sinal #1 — NF vencida (>30d sem pagar)
          const nfVencidas = cInvoices.filter((inv) => {
            if (!inv.nf_data) return false;
            if (inv.status === "pago") return false;
            const days = differenceInCalendarDays(parseISO(inv.nf_data), today);
            return days < -NF_VENCIDA_DIAS;
          });
          if (nfVencidas.length > 0) {
            signals.push({
              type: "nf_vencida",
              severity: "vermelho",
              message: `${nfVencidas.length} NF${nfVencidas.length > 1 ? "s" : ""} vencida${nfVencidas.length > 1 ? "s" : ""} há +${NF_VENCIDA_DIAS}d`,
              count: nfVencidas.length,
            });
          }

          // Sinal #2 — NF vencendo (15-30d sem pagar)
          const nfVencendo = cInvoices.filter((inv) => {
            if (!inv.nf_data) return false;
            if (inv.status === "pago") return false;
            const days = differenceInCalendarDays(parseISO(inv.nf_data), today);
            return days >= -NF_VENCIDA_DIAS && days < -NF_VENCENDO_DIAS;
          });
          if (nfVencendo.length > 0) {
            signals.push({
              type: "nf_vencendo",
              severity: "amarelo",
              message: `${nfVencendo.length} NF${nfVencendo.length > 1 ? "s" : ""} aberta${nfVencendo.length > 1 ? "s" : ""} há ${NF_VENCENDO_DIAS}-${NF_VENCIDA_DIAS}d`,
              count: nfVencendo.length,
            });
          }

          // Sinal #3 — Projeto entregue sem NF (>7d, billing depende de NF)
          const invoicesByProject = new Map<string, InvoiceRow[]>();
          for (const inv of cInvoices) {
            const arr = invoicesByProject.get(inv.project_id) ?? [];
            arr.push(inv);
            invoicesByProject.set(inv.project_id, arr);
          }
          const projetosSemNf = cProjects.filter((p) => {
            if (p.execution_status !== "entregue") return false;
            if (
              !p.billing_type ||
              !["entrega_nf", "entrega_recibo"].includes(p.billing_type)
            )
              return false;
            const projInvoices = invoicesByProject.get(p.id) ?? [];
            if (projInvoices.length > 0) return false;
            const ref = p.delivered_at ?? p.updated_at;
            if (!ref) return false;
            const days = differenceInCalendarDays(parseISO(ref), today);
            return days < -PROJETO_SEM_NF_DIAS;
          });
          if (projetosSemNf.length > 0) {
            const valorTotal = projetosSemNf.reduce(
              (s, p) => s + Number(p.contract_value ?? 0),
              0,
            );
            const isCritico = valorTotal > PROJETO_SEM_NF_VALOR_CRITICO;
            signals.push({
              type: "projeto_sem_nf",
              severity: isCritico ? "vermelho" : "amarelo",
              message: `${projetosSemNf.length} projeto${projetosSemNf.length > 1 ? "s" : ""} entregue${projetosSemNf.length > 1 ? "s" : ""} sem NF`,
              count: projetosSemNf.length,
              value: valorTotal,
            });
          }

          // Sinal #4 — Proposta sem resposta (>14d em "enviada")
          const propostasSemResposta = cProposals.filter((pr) => {
            if (pr.status !== "enviada") return false;
            const ref = pr.sent_at ?? pr.created_at;
            if (!ref) return false;
            const days = differenceInCalendarDays(parseISO(ref), today);
            return days < -PROPOSTA_SEM_RESPOSTA_DIAS;
          });
          if (propostasSemResposta.length > 0) {
            signals.push({
              type: "proposta_sem_resposta",
              severity: "amarelo",
              message: `${propostasSemResposta.length} proposta${propostasSemResposta.length > 1 ? "s" : ""} sem resposta há +${PROPOSTA_SEM_RESPOSTA_DIAS}d`,
              count: propostasSemResposta.length,
              suggestion: "Reenviar / fazer follow-up",
            });
          }

          // Sinal #5 — Compliance: integração vencida
          const integVencidas = cIntegrations.filter((i) => {
            if (!i.expiry_date) return false;
            const days = differenceInCalendarDays(parseISO(i.expiry_date), today);
            return days < 0;
          });
          if (integVencidas.length > 0) {
            signals.push({
              type: "compliance_vencido",
              severity: "vermelho",
              message: `${integVencidas.length} integração${integVencidas.length > 1 ? "ões" : ""} de funcionário vencida${integVencidas.length > 1 ? "s" : ""}`,
              count: integVencidas.length,
            });
          }

          // Sinal #6 — Sem atividade (>30d) com projeto ativo
          if (projetosAtivos > 0 && ultimaAtividade) {
            const days = differenceInCalendarDays(parseISO(ultimaAtividade), today);
            if (days < -SEM_ATIVIDADE_DIAS) {
              signals.push({
                type: "sem_atividade",
                severity: "amarelo",
                message: `Sem atividade há ${Math.abs(days)} dias`,
              });
            }
          }

          // Sinal #7 — Alerta urgente em projeto do cliente
          const alertasUrgentes = cAlerts.filter((a) => a.priority === "urgente");
          if (alertasUrgentes.length > 0) {
            signals.push({
              type: "alerta_urgente",
              severity: "amarelo",
              message: `${alertasUrgentes.length} alerta${alertasUrgentes.length > 1 ? "s" : ""} urgente${alertasUrgentes.length > 1 ? "s" : ""} pendente${alertasUrgentes.length > 1 ? "s" : ""}`,
              count: alertasUrgentes.length,
              suggestion: "Ver alertas no Radar",
            });
          }

          // ── Em dia (placeholder se nada disparou) ──────────────────────────
          if (signals.length === 0) {
            signals.push({
              type: "em_dia",
              severity: "verde",
              message: "Em dia",
            });
          }

          const semaforo = classifySemaforo(signals);

          // Comercial responsável: pega o do projeto ativo mais recente.
          const activeProjects = cProjects
            .filter((p) => p.execution_status && !TERMINAL_PROJECT_STATUSES.has(p.execution_status))
            .sort((a, b) =>
              (b.updated_at ?? b.created_at ?? "").localeCompare(
                a.updated_at ?? a.created_at ?? "",
              ),
            );
          const comercialId =
            activeProjects.find((p) => p.responsible_comercial_id)?.responsible_comercial_id ??
            cProjects.find((p) => p.responsible_comercial_id)?.responsible_comercial_id ??
            null;
          const comercialNome = comercialId
            ? profileNameById.get(comercialId) ?? null
            : null;

          // Billing dominante: tipo mais comum entre projetos ativos.
          const billingCounts = new Map<string, number>();
          for (const p of cProjects) {
            if (!p.billing_type) continue;
            billingCounts.set(p.billing_type, (billingCounts.get(p.billing_type) ?? 0) + 1);
          }
          let billingDominante: string | null = null;
          let topCount = 0;
          for (const [k, v] of billingCounts) {
            if (v > topCount) {
              topCount = v;
              billingDominante = k;
            }
          }

          return {
            client: c as Client,
            kpis: {
              projetosAtivos,
              aReceber,
              alertas: cAlerts.length,
              ultimaAtividade,
            },
            signals,
            semaforo,
            comercialResponsavel: comercialNome,
            comercialResponsavelId: comercialId,
            segmento: c.segmento ?? null,
            cnpjPrincipal: c.cnpj ?? null,
            billingDominante,
          };
        });

      rows.sort((a, b) => {
        const bySemaforo = severityRank(a.semaforo) - severityRank(b.semaforo);
        if (bySemaforo !== 0) return bySemaforo;
        const aIso = a.kpis.ultimaAtividade ?? "";
        const bIso = b.kpis.ultimaAtividade ?? "";
        if (aIso && bIso) return bIso.localeCompare(aIso);
        if (aIso) return -1;
        if (bIso) return 1;
        return a.client.name.localeCompare(b.client.name);
      });

      void todayIso;
      return rows;
    },
    staleTime: 30_000,
  });
}
