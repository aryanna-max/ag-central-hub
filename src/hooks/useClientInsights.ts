import { useQuery } from "@tanstack/react-query";
import { differenceInCalendarDays, parseISO, subMonths } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

const MIN_NFS_FOR_PAYMENT = 3;
const MIN_PROJECTS_FOR_FREQUENCY = 2;
const MIN_PROJECTS_FOR_DELAY = 3;

export interface ReceitaTrimestre {
  atual: number;
  anterior: number;
  variacaoPct: number;
}

export interface PadraoAtraso {
  totalProjetos: number;
  projetosAtrasados: number;
  pct: number;
}

export interface FrequenciaProjetos {
  projetos12Meses: number;
  intervaloMedioDias: number | null;
  tendencia: "aumentando" | "estavel" | "diminuindo" | null;
}

export interface TempoMedioPagamento {
  nfsConsideradas: number;
  diasMedioPagamento: number | null;
}

export interface ClientInsights {
  receitaTrimestreVsAnterior: ReceitaTrimestre | null;
  padraoAtraso: PadraoAtraso | null;
  frequenciaProjetos: FrequenciaProjetos | null;
  tempoMedioPagamento: TempoMedioPagamento | null;
}

type ProjectRow = Pick<
  Database["public"]["Tables"]["projects"]["Row"],
  | "id"
  | "client_id"
  | "delivery_deadline"
  | "delivered_at"
  | "created_at"
  | "is_active"
>;

type InvoiceRow = Pick<
  Database["public"]["Tables"]["invoices"]["Row"],
  "id" | "project_id" | "status" | "valor_liquido" | "nf_data" | "updated_at"
>;

function quarterStart(date: Date): Date {
  const m = date.getMonth();
  const qStart = Math.floor(m / 3) * 3;
  return new Date(date.getFullYear(), qStart, 1);
}

function previousQuarterStart(date: Date): Date {
  const qs = quarterStart(date);
  const prev = new Date(qs);
  prev.setMonth(prev.getMonth() - 3);
  return prev;
}

export function useClientInsights(clientId: string | undefined) {
  return useQuery<ClientInsights>({
    queryKey: ["client-insights", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const since12m = subMonths(today, 12);
      const since6m = subMonths(today, 6);
      const qStart = quarterStart(today);
      const qPrevStart = previousQuarterStart(today);

      const [projectsRes, invoicesRes] = await Promise.all([
        supabase
          .from("projects")
          .select(
            "id, client_id, delivery_deadline, delivered_at, created_at, is_active",
          )
          .eq("client_id", clientId!),
        supabase
          .from("invoices")
          .select("id, project_id, status, valor_liquido, nf_data, updated_at")
          .in(
            "project_id",
            (
              await supabase
                .from("projects")
                .select("id")
                .eq("client_id", clientId!)
            ).data?.map((p) => p.id) ?? [],
          ),
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (invoicesRes.error) throw invoicesRes.error;

      const projects = (projectsRes.data ?? []) as ProjectRow[];
      const invoices = (invoicesRes.data ?? []) as InvoiceRow[];

      // ── Receita Q corrente vs Q anterior ─────────────────────────────────
      const currentQ = invoices.filter((inv) => {
        if (!inv.nf_data) return false;
        const d = parseISO(inv.nf_data);
        return d >= qStart && d <= today;
      });
      const prevQ = invoices.filter((inv) => {
        if (!inv.nf_data) return false;
        const d = parseISO(inv.nf_data);
        return d >= qPrevStart && d < qStart;
      });
      const sumCurrent = currentQ.reduce(
        (s, inv) => s + Number(inv.valor_liquido ?? 0),
        0,
      );
      const sumPrev = prevQ.reduce(
        (s, inv) => s + Number(inv.valor_liquido ?? 0),
        0,
      );
      const receitaTrimestreVsAnterior: ReceitaTrimestre | null =
        currentQ.length === 0 && prevQ.length === 0
          ? null
          : {
              atual: sumCurrent,
              anterior: sumPrev,
              variacaoPct:
                sumPrev > 0
                  ? Math.round(((sumCurrent - sumPrev) / sumPrev) * 100)
                  : sumCurrent > 0
                    ? 100
                    : 0,
            };

      // ── Padrão atraso (últimos 6 meses) ──────────────────────────────────
      const projetos6m = projects.filter((p) => {
        if (!p.delivered_at) return false;
        const d = parseISO(p.delivered_at);
        return d >= since6m && d <= today;
      });
      let padraoAtraso: PadraoAtraso | null = null;
      if (projetos6m.length >= MIN_PROJECTS_FOR_DELAY) {
        const atrasados = projetos6m.filter((p) => {
          if (!p.delivery_deadline || !p.delivered_at) return false;
          const deadline = parseISO(p.delivery_deadline);
          const delivered = parseISO(p.delivered_at);
          return delivered > deadline;
        });
        padraoAtraso = {
          totalProjetos: projetos6m.length,
          projetosAtrasados: atrasados.length,
          pct: Math.round((atrasados.length / projetos6m.length) * 100),
        };
      }

      // ── Frequência projetos (últimos 12 meses) ───────────────────────────
      const projetos12m = projects.filter((p) => {
        if (!p.created_at) return false;
        const d = parseISO(p.created_at);
        return d >= since12m && d <= today;
      });
      let frequenciaProjetos: FrequenciaProjetos | null = null;
      if (projetos12m.length === 0) {
        frequenciaProjetos = null;
      } else if (projetos12m.length < MIN_PROJECTS_FOR_FREQUENCY) {
        frequenciaProjetos = {
          projetos12Meses: projetos12m.length,
          intervaloMedioDias: null,
          tendencia: null,
        };
      } else {
        const sorted = [...projetos12m].sort((a, b) =>
          (a.created_at ?? "").localeCompare(b.created_at ?? ""),
        );
        const intervals: number[] = [];
        for (let i = 1; i < sorted.length; i++) {
          const prev = parseISO(sorted[i - 1].created_at!);
          const curr = parseISO(sorted[i].created_at!);
          intervals.push(differenceInCalendarDays(curr, prev));
        }
        const avg = Math.round(
          intervals.reduce((s, n) => s + n, 0) / intervals.length,
        );

        // Tendência: comparar metade mais recente vs metade anterior
        let tendencia: "aumentando" | "estavel" | "diminuindo" | null = null;
        if (intervals.length >= 4) {
          const half = Math.floor(intervals.length / 2);
          const recent = intervals.slice(half);
          const older = intervals.slice(0, half);
          const recentAvg = recent.reduce((s, n) => s + n, 0) / recent.length;
          const olderAvg = older.reduce((s, n) => s + n, 0) / older.length;
          const diff = recentAvg - olderAvg;
          if (Math.abs(diff) < 7) tendencia = "estavel";
          else if (diff < 0) tendencia = "aumentando";
          else tendencia = "diminuindo";
        }

        frequenciaProjetos = {
          projetos12Meses: projetos12m.length,
          intervaloMedioDias: avg,
          tendencia,
        };
      }

      // ── Tempo médio pagamento (NFs pagas com nf_data + updated_at) ───────
      const nfsPagas = invoices.filter(
        (inv) => inv.status === "pago" && inv.nf_data && inv.updated_at,
      );
      let tempoMedioPagamento: TempoMedioPagamento | null = null;
      if (nfsPagas.length === 0) {
        tempoMedioPagamento = null;
      } else if (nfsPagas.length < MIN_NFS_FOR_PAYMENT) {
        tempoMedioPagamento = {
          nfsConsideradas: nfsPagas.length,
          diasMedioPagamento: null,
        };
      } else {
        const dias = nfsPagas.map((inv) =>
          differenceInCalendarDays(
            parseISO(inv.updated_at!),
            parseISO(inv.nf_data!),
          ),
        );
        const avgDias = Math.round(dias.reduce((s, n) => s + n, 0) / dias.length);
        tempoMedioPagamento = {
          nfsConsideradas: nfsPagas.length,
          diasMedioPagamento: Math.max(0, avgDias),
        };
      }

      return {
        receitaTrimestreVsAnterior,
        padraoAtraso,
        frequenciaProjetos,
        tempoMedioPagamento,
      };
    },
    staleTime: 60_000,
  });
}
