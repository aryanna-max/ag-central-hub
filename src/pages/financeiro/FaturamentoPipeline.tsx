import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInCalendarDays, startOfMonth, endOfMonth, format } from "date-fns";
import DeadlineBadge from "@/components/DeadlineBadge";
import { EXEC_STATUS_LABELS, EXEC_STATUS_COLORS, BILLING_LABELS, BILLING_COLORS } from "@/lib/statusConstants";

const fmtCurrency = (v: number | null | undefined) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const statusBadgeMap: Record<string, { label: string; color: string }> = {
  rascunho: { label: "Rascunho", color: "bg-gray-100 text-gray-800" },
  aguardando_aprovacao: { label: "Aguardando aprovação", color: "bg-yellow-100 text-yellow-800" },
};

interface PipelineProject {
  id: string;
  codigo: string | null;
  name: string;
  execution_status: string | null;
  delivery_deadline: string | null;
  billing_type: string | null;
  contract_value: number | null;
  start_date: string | null;
  delivery_days_estimated: number | null;
  delivered_at: string | null;
  client_name: string | null;
}

export default function FaturamentoPipeline() {
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["faturamento-pipeline"],
    queryFn: async () => {
      const { data: projs, error } = await supabase
        .from("projects")
        .select("id, codigo, name, execution_status, delivery_deadline, billing_type, contract_value, start_date, delivery_days_estimated, delivered_at, client_id, is_active")
        .in("execution_status", ["aguardando_processamento", "em_processamento", "revisao", "aprovado"] as any)
        .not("delivery_deadline", "is", null)
        .eq("is_active", true)
        .order("delivery_deadline", { ascending: true });
      if (error) throw error;

      const clientIds = [...new Set((projs || []).map((p: any) => p.client_id).filter(Boolean))];
      let clientsMap: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase.from("clients").select("id, name").in("id", clientIds);
        (clients || []).forEach((c: any) => { clientsMap[c.id] = c.name; });
      }

      return (projs || []).map((p: any): PipelineProject => ({
        id: p.id, codigo: p.codigo, name: p.name, execution_status: p.execution_status,
        delivery_deadline: p.delivery_deadline, billing_type: p.billing_type,
        contract_value: p.contract_value != null ? Number(p.contract_value) : null,
        start_date: p.start_date, delivery_days_estimated: p.delivery_days_estimated,
        delivered_at: p.delivered_at,
        client_name: p.client_id ? clientsMap[p.client_id] || null : null,
      }));
    },
  });

  // Measurements pending
  const { data: measurements = [] } = useQuery({
    queryKey: ["faturamento-pipeline-measurements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("measurements")
        .select("id, project_id, period_start, period_end, valor_bruto, status")
        .in("status", ["rascunho", "aguardando_aprovacao"])
        .order("period_end", { ascending: true });
      if (error) throw error;

      const projectIds = [...new Set((data || []).map((m: any) => m.project_id).filter(Boolean))];
      let projectsMap: Record<string, any> = {};
      let clientsMap: Record<string, string> = {};
      if (projectIds.length > 0) {
        const { data: pData } = await supabase.from("projects").select("id, codigo, name, client_id").in("id", projectIds);
        (pData || []).forEach((p: any) => { projectsMap[p.id] = p; });
        const cIds = [...new Set((pData || []).map((p: any) => p.client_id).filter(Boolean))];
        if (cIds.length > 0) {
          const { data: cData } = await supabase.from("clients").select("id, name").in("id", cIds);
          (cData || []).forEach((c: any) => { clientsMap[c.id] = c.name; });
        }
      }

      return (data || []).map((m: any) => {
        const proj = m.project_id ? projectsMap[m.project_id] : null;
        return {
          ...m,
          project_codigo: proj?.codigo || "—",
          project_name: proj?.name || "—",
          client_name: proj?.client_id ? clientsMap[proj.client_id] || "—" : "—",
        };
      });
    },
  });

  // Projection data (all projects + measurements for this month)
  const { data: allProjects = [] } = useQuery({
    queryKey: ["faturamento-pipeline-all-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, delivery_deadline, contract_value, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: allMeasurements = [] } = useQuery({
    queryKey: ["faturamento-pipeline-all-measurements"],
    queryFn: async () => {
      const { data, error } = await supabase.from("measurements").select("id, period_end, valor_bruto");
      if (error) throw error;
      return data || [];
    },
  });

  const groups = useMemo(() => {
    const today = new Date();
    const thisWeek: PipelineProject[] = [];
    const thisMonth: PipelineProject[] = [];
    const later: PipelineProject[] = [];

    projects.forEach((p) => {
      if (!p.delivery_deadline) return;
      const days = differenceInCalendarDays(new Date(p.delivery_deadline), today);
      if (days <= 7) thisWeek.push(p);
      else if (days <= 30) thisMonth.push(p);
      else later.push(p);
    });

    return [
      { title: "🔴 Esta semana", items: thisWeek },
      { title: "🟡 Este mês", items: thisMonth },
      { title: "🟢 Depois de 30 dias", items: later },
    ];
  }, [projects]);

  const projection = useMemo(() => {
    const now = new Date();
    const s = startOfMonth(now);
    const e = endOfMonth(now);

    const entregas = allProjects.filter((p: any) => {
      if (!p.delivery_deadline) return false;
      const d = new Date(p.delivery_deadline + "T12:00:00");
      return d >= s && d <= e;
    });
    const meds = allMeasurements.filter((m: any) => {
      if (!m.period_end) return false;
      const d = new Date(m.period_end + "T12:00:00");
      return d >= s && d <= e;
    });

    const somaEntregas = entregas.reduce((a: number, p: any) => a + (Number(p.contract_value) || 0), 0);
    const somaMeds = meds.reduce((a: number, m: any) => a + (Number(m.valor_bruto) || 0), 0);

    return { entregasCount: entregas.length, somaEntregas, medsCount: meds.length, somaMeds, total: somaEntregas + somaMeds };
  }, [allProjects, allMeasurements]);

  if (isLoading) {
    return <p className="text-muted-foreground text-center py-8">Carregando pipeline...</p>;
  }

  return (
    <div className="space-y-6">
      {/* Section A — Próximas entregas */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Próximas entregas esperadas</h2>
        {groups.map((group) => (
          <div key={group.title} className="space-y-3 mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
              {group.title}
              <Badge variant="secondary" className="text-xs">{group.items.length}</Badge>
            </h3>

            {group.items.length === 0 ? (
              <p className="text-xs text-muted-foreground pl-2">Nenhum projeto neste período.</p>
            ) : (
              <div className="grid gap-3">
                {group.items.map((p) => {
                  const execLabel = p.execution_status ? EXEC_STATUS_LABELS[p.execution_status] : null;
                  const execColor = p.execution_status ? EXEC_STATUS_COLORS[p.execution_status] : "";
                  const billingLabel = p.billing_type ? BILLING_LABELS[p.billing_type] : null;
                  const billingColor = p.billing_type ? BILLING_COLORS[p.billing_type] : "";

                  return (
                    <Card key={p.id}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1 flex-1 min-w-0">
                            <p className="font-semibold text-sm">
                              {p.codigo && <span className="font-mono text-primary">{p.codigo}</span>}
                              {p.codigo && " · "}
                              {p.client_name || ""}
                            </p>
                            <p className="text-xs text-muted-foreground">{p.name}</p>
                            <div className="flex items-center gap-2 flex-wrap">
                              {execLabel && (
                                <Badge variant="outline" className={`text-[10px] ${execColor}`}>{execLabel}</Badge>
                              )}
                              {billingLabel && (
                                <Badge variant="outline" className={`text-[10px] ${billingColor}`}>{billingLabel}</Badge>
                              )}
                            </div>
                            {p.contract_value != null && p.contract_value > 0 && (
                              <p className="text-sm font-medium mt-1">{fmtCurrency(p.contract_value)}</p>
                            )}
                          </div>
                          <DeadlineBadge
                            deadline={p.delivery_deadline ? new Date(p.delivery_deadline) : null}
                            started_at={p.start_date ? new Date(p.start_date) : null}
                            estimated_days={p.delivery_days_estimated}
                            completed_at={p.delivered_at ? new Date(p.delivered_at) : null}
                            label="Entrega"
                          />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {projects.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center text-muted-foreground">
              Nenhum projeto no pipeline de entrega.
            </CardContent>
          </Card>
        )}
      </div>

      {/* Section B — Medições a vencer */}
      {measurements.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Medições a vencer</h2>
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Valor bruto</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {measurements.map((m: any) => {
                      const sb = statusBadgeMap[m.status] || { label: m.status, color: "bg-muted" };
                      return (
                        <TableRow key={m.id}>
                          <TableCell>{m.client_name}</TableCell>
                          <TableCell className="font-mono text-xs">{m.project_codigo}</TableCell>
                          <TableCell className="text-xs">
                            {format(new Date(m.period_start + "T12:00:00"), "dd/MM")} — {format(new Date(m.period_end + "T12:00:00"), "dd/MM/yy")}
                          </TableCell>
                          <TableCell className="text-right">{fmtCurrency(m.valor_bruto)}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`text-[10px] ${sb.color}`}>{sb.label}</Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Section C — Projeção do mês corrente */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Projeção do mês corrente</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Entregas previstas</p>
              <p className="text-2xl font-bold">{projection.entregasCount}</p>
              <p className="text-sm font-medium">{fmtCurrency(projection.somaEntregas)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Medições previstas</p>
              <p className="text-2xl font-bold">{projection.medsCount}</p>
              <p className="text-sm font-medium">{fmtCurrency(projection.somaMeds)}</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5">
            <CardContent className="p-4 text-center">
              <p className="text-sm text-muted-foreground">Total projetado</p>
              <p className="text-2xl font-bold text-primary">{fmtCurrency(projection.total)}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
