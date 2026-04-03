import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { differenceInCalendarDays } from "date-fns";
import DeadlineBadge from "@/components/DeadlineBadge";

const executionLabels: Record<string, { label: string; color: string }> = {
  aguardando_processamento: { label: "Aguardando Processamento", color: "bg-slate-100 text-slate-700" },
  em_processamento: { label: "Em Processamento", color: "bg-blue-100 text-blue-700" },
  revisao: { label: "Revisão", color: "bg-amber-100 text-amber-700" },
  aprovado: { label: "Aprovado", color: "bg-emerald-100 text-emerald-700" },
};

const billingLabels: Record<string, { label: string; color: string }> = {
  medicao_mensal: { label: "Medição Mensal", color: "bg-blue-100 text-blue-800 border-blue-200" },
  entrega_nf: { label: "NF na Entrega", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  entrega_recibo: { label: "Recibo na Entrega", color: "bg-amber-100 text-amber-800 border-amber-200" },
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
        .in("execution_status", ["aguardando_processamento", "em_processamento", "revisao", "aprovado"])
        .not("delivery_deadline", "is", null)
        .eq("is_active", true)
        .order("delivery_deadline", { ascending: true });
      if (error) throw error;

      const clientIds = (projs || []).map((p: any) => p.client_id).filter(Boolean);
      let clientsMap: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase
          .from("clients")
          .select("id, name")
          .in("id", clientIds);
        (clients || []).forEach((c: any) => { clientsMap[c.id] = c.name; });
      }

      return (projs || []).map((p: any): PipelineProject => ({
        id: p.id,
        codigo: p.codigo,
        name: p.name,
        execution_status: p.execution_status,
        delivery_deadline: p.delivery_deadline,
        billing_type: p.billing_type,
        contract_value: p.contract_value != null ? Number(p.contract_value) : null,
        start_date: p.start_date,
        delivery_days_estimated: p.delivery_days_estimated,
        delivered_at: p.delivered_at,
        client_name: p.client_id ? clientsMap[p.client_id] || null : null,
      }));
    },
  });

  const groups = useMemo(() => {
    const today = new Date();
    const thisWeek: PipelineProject[] = [];
    const next30: PipelineProject[] = [];
    const later: PipelineProject[] = [];

    projects.forEach((p) => {
      if (!p.delivery_deadline) return;
      const days = differenceInCalendarDays(new Date(p.delivery_deadline), today);
      if (days <= 7) thisWeek.push(p);
      else if (days <= 30) next30.push(p);
      else later.push(p);
    });

    return [
      { title: "Esta semana", items: thisWeek },
      { title: "Próximos 30 dias", items: next30 },
      { title: "Depois", items: later },
    ];
  }, [projects]);

  if (isLoading) {
    return <p className="text-muted-foreground text-center py-8">Carregando pipeline...</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        Projetos com entrega prevista — acompanhamento para faturamento.
      </p>

      {groups.map((group) => (
        <div key={group.title} className="space-y-3">
          <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
            {group.title}
            <Badge variant="secondary" className="text-xs">{group.items.length}</Badge>
          </h3>

          {group.items.length === 0 ? (
            <p className="text-xs text-muted-foreground pl-2">Nenhum projeto neste período.</p>
          ) : (
            <div className="grid gap-3">
              {group.items.map((p) => {
                const exec = p.execution_status ? executionLabels[p.execution_status] : null;
                const billing = p.billing_type ? billingLabels[p.billing_type] : null;

                return (
                  <Card key={p.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="font-semibold text-sm">
                            {p.codigo && <span className="font-mono text-primary">{p.codigo}</span>}
                            {p.codigo && " — "}
                            {p.name}
                          </p>
                          {p.client_name && (
                            <p className="text-xs text-muted-foreground">{p.client_name}</p>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                            {exec && (
                              <Badge variant="outline" className={`text-[10px] ${exec.color}`}>
                                {exec.label}
                              </Badge>
                            )}
                            {billing && (
                              <Badge variant="outline" className={`text-[10px] ${billing.color}`}>
                                {billing.label}
                              </Badge>
                            )}
                          </div>
                          {p.contract_value != null && p.contract_value > 0 && (
                            <p className="text-sm font-medium mt-1">
                              {p.contract_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                            </p>
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
  );
}
