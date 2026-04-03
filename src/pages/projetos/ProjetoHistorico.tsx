import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjects } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useEmployees } from "@/hooks/useEmployees";
import { useMeasurements } from "@/hooks/useMeasurements";
import { useProjectServices } from "@/hooks/useProjectServices";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import DeadlineBadge from "@/components/DeadlineBadge";
import {
  ArrowLeft, Building2, MapPin, Calendar, DollarSign,
  FileText, Users, Clock, FolderKanban, Receipt,
  AlertTriangle, CheckCircle2, Briefcase,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const EXEC_LABELS: Record<string, string> = {
  aguardando_campo: "Aguardando campo", em_campo: "Em campo",
  campo_concluido: "Campo concluído", aguardando_processamento: "Aguardando proc.",
  em_processamento: "Em processamento", revisao: "Em revisão",
  aprovado: "Aprovado", entregue: "Entregue", faturamento: "Faturamento", pago: "Pago",
};
const EXEC_COLORS: Record<string, string> = {
  aguardando_campo: "bg-emerald-100 text-emerald-800", em_campo: "bg-green-100 text-green-800",
  campo_concluido: "bg-teal-100 text-teal-800", aguardando_processamento: "bg-sky-100 text-sky-800",
  em_processamento: "bg-blue-100 text-blue-800", revisao: "bg-indigo-100 text-indigo-800",
  aprovado: "bg-violet-100 text-violet-800", entregue: "bg-orange-100 text-orange-800",
  faturamento: "bg-amber-100 text-amber-800", pago: "bg-emerald-100 text-emerald-800",
};
const STATUS_LABELS: Record<string, string> = {
  planejamento: "Planejamento", execucao: "Execução", entrega: "Entrega",
  faturamento: "Faturamento", concluido: "Concluído", pausado: "Pausado",
};
const BILLING_LABELS: Record<string, string> = {
  medicao_mensal: "Medição Mensal", entrega_nf: "NF na Entrega",
  entrega_recibo: "Recibo na Entrega", sem_documento: "Sem Documento",
};
const MEAS_STATUS: Record<string, string> = {
  rascunho: "Rascunho", aguardando_aprovacao: "Aguardando", aprovada: "Aprovada",
  nf_emitida: "NF Emitida", paga: "Paga", cancelada: "Cancelada",
};

const fmtBRL = (v: number | null) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

const fmtDate = (d: string | null) =>
  d ? format(parseISO(d), "dd/MM/yyyy") : "—";

export default function ProjetoHistorico() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: employees = [] } = useEmployees();
  const { data: measurements = [] } = useMeasurements();
  const { data: services = [] } = useProjectServices(projectId || "");

  // Status history
  const { data: statusHistory = [] } = useQuery({
    queryKey: ["project-status-history", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_status_history")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  // Alerts for this project
  const { data: projectAlerts = [] } = useQuery({
    queryKey: ["project-alerts", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("reference_id", projectId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);
  const client = useMemo(() => clients.find((c) => c.id === project?.client_id), [clients, project]);
  const empMap = useMemo(() => new Map(employees.map((e) => [e.id, e.name])), [employees]);
  const projMeasurements = useMemo(
    () => measurements.filter((m) => m.project_id === projectId),
    [measurements, projectId],
  );

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Projeto não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const p = project;
  const responsible = p.responsible_id ? empMap.get(p.responsible_id) : p.responsible;
  const totalMeasured = projMeasurements.reduce((s, m) => s + (m.valor_bruto || 0), 0);
  const totalNF = projMeasurements.reduce((s, m) => s + (m.valor_nf || 0), 0);
  const location = [p.cidade, p.estado].filter(Boolean).join("/");
  const address = [p.rua, p.numero, p.bairro].filter(Boolean).join(", ");

  const daysInField = p.field_started_at
    ? differenceInDays(p.field_completed_at ? new Date(p.field_completed_at) : new Date(), new Date(p.field_started_at))
    : null;

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1200px] mx-auto">
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col gap-3">
        <Button variant="ghost" size="sm" className="self-start -ml-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-sm font-bold">{p.codigo || "—"}</Badge>
              {p.execution_status && (
                <Badge className={EXEC_COLORS[p.execution_status] || "bg-muted"}>
                  {EXEC_LABELS[p.execution_status] || p.execution_status}
                </Badge>
              )}
              <Badge variant="secondary">{STATUS_LABELS[p.status] || p.status}</Badge>
            </div>
            <h1 className="text-2xl font-bold mt-2">{p.name}</h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
              {client && (
                <span className="flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5" /> {client.name}
                </span>
              )}
              {location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" /> {location}
                </span>
              )}
              {p.service && (
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3.5 h-3.5" /> {p.service}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ KPIs ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <InfoCard
          icon={<DollarSign className="w-5 h-5 text-emerald-600" />}
          label="Valor Contrato"
          value={fmtBRL(p.contract_value)}
        />
        <InfoCard
          icon={<Receipt className="w-5 h-5 text-blue-600" />}
          label="Total Medido"
          value={fmtBRL(totalMeasured)}
        />
        <InfoCard
          icon={<FileText className="w-5 h-5 text-amber-600" />}
          label="Total NF"
          value={fmtBRL(totalNF)}
        />
        <InfoCard
          icon={<Clock className="w-5 h-5 text-purple-600" />}
          label="Dias em Campo"
          value={daysInField != null ? `${daysInField} dias` : "—"}
        />
      </div>

      {/* ═══ DATAS E PRAZOS ═══ */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <Calendar className="w-4 h-4" /> Cronograma
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Início</p>
              <p className="font-medium">{fmtDate(p.start_date)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Início Campo</p>
              <p className="font-medium">{fmtDate(p.field_started_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Campo Concluído</p>
              <p className="font-medium">{fmtDate(p.field_completed_at)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Entregue em</p>
              <p className="font-medium">{fmtDate(p.delivered_at)}</p>
            </div>
          </div>
          <Separator className="my-3" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Prazo Campo</p>
              {p.field_deadline ? (
                <DeadlineBadge
                  deadline={new Date(p.field_deadline)}
                  started_at={p.field_started_at ? new Date(p.field_started_at) : null}
                  estimated_days={p.field_days_estimated}
                  completed_at={p.field_completed_at ? new Date(p.field_completed_at) : null}
                  label="Campo"
                />
              ) : <p className="font-medium">—</p>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Prazo Entrega</p>
              {p.delivery_deadline ? (
                <DeadlineBadge
                  deadline={new Date(p.delivery_deadline)}
                  started_at={p.field_completed_at ? new Date(p.field_completed_at) : null}
                  estimated_days={p.delivery_days_estimated}
                  completed_at={p.delivered_at ? new Date(p.delivered_at) : null}
                  label="Entrega"
                />
              ) : <p className="font-medium">—</p>}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Responsável</p>
              <p className="font-medium">{responsible || "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ FATURAMENTO ═══ */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4" /> Faturamento
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Tipo</p>
              <p className="font-medium">
                {p.billing_type ? (
                  <Badge variant="outline">{BILLING_LABELS[p.billing_type] || p.billing_type}</Badge>
                ) : <Badge className="bg-red-100 text-red-800">⚠ Não definido</Badge>}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Empresa Faturadora</p>
              <p className="font-medium">{p.empresa_faturadora || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">CNPJ Tomador</p>
              <p className="font-medium font-mono text-xs">{p.cnpj_tomador || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Conta Bancária</p>
              <p className="font-medium">{p.conta_bancaria || "—"}</p>
            </div>
          </div>
          {(p.contato_engenheiro || p.contato_financeiro) && (
            <>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Contato Engenheiro</p>
                  <p className="font-medium">{p.contato_engenheiro || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contato Financeiro</p>
                  <p className="font-medium">{p.contato_financeiro || "—"}</p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ═══ SERVIÇOS ═══ */}
      {services.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FolderKanban className="w-4 h-4" /> Serviços ({services.length})
            </h3>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Modo</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Início</TableHead>
                    <TableHead>Fim</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.service_type}</TableCell>
                      <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                      <TableCell className="text-sm">{s.billing_mode || "—"}</TableCell>
                      <TableCell className="text-right">{fmtBRL(s.contract_value)}</TableCell>
                      <TableCell className="text-sm">{fmtDate(s.start_date)}</TableCell>
                      <TableCell className="text-sm">{fmtDate(s.end_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ MEDIÇÕES ═══ */}
      {projMeasurements.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Medições ({projMeasurements.length})
            </h3>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código BM</TableHead>
                    <TableHead>Período</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Bruto</TableHead>
                    <TableHead className="text-right">NF</TableHead>
                    <TableHead>NF Nº</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projMeasurements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono font-medium text-sm">{m.codigo_bm}</TableCell>
                      <TableCell className="text-sm">{fmtDate(m.period_start)} — {fmtDate(m.period_end)}</TableCell>
                      <TableCell><Badge variant="outline">{MEAS_STATUS[m.status] || m.status}</Badge></TableCell>
                      <TableCell className="text-right">{fmtBRL(m.valor_bruto)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(m.valor_nf)}</TableCell>
                      <TableCell className="text-sm">{m.nf_numero || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-6 mt-3 text-sm">
              <div><span className="text-muted-foreground">Total Bruto:</span> <span className="font-semibold">{fmtBRL(totalMeasured)}</span></div>
              <div><span className="text-muted-foreground">Total NF:</span> <span className="font-semibold">{fmtBRL(totalNF)}</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ ALERTAS DO PROJETO ═══ */}
      {projectAlerts.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Alertas ({projectAlerts.length})
            </h3>
            <div className="space-y-2">
              {projectAlerts.map((a: any) => (
                <div key={a.id} className={cn(
                  "p-3 rounded-lg border text-sm flex items-start gap-3",
                  a.resolved && "opacity-60",
                  a.priority === "urgente" && "border-red-200 bg-red-50 dark:bg-red-950/20",
                  a.priority === "importante" && "border-amber-200 bg-amber-50 dark:bg-amber-950/20",
                )}>
                  <div className="flex-1">
                    <p className="font-medium">{a.message || a.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {fmtDate(a.created_at)} · {a.resolved ? (a.alert_status || "resolvido") : (a.alert_status || "ativo")}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">{a.priority}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ HISTÓRICO DE STATUS ═══ */}
      {statusHistory.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Clock className="w-4 h-4" /> Histórico de Status
            </h3>
            <div className="space-y-2">
              {statusHistory.map((h: any) => (
                <div key={h.id} className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-muted/50">
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-muted-foreground">{h.from_status || "—"}</span>
                    <span className="mx-2">→</span>
                    <span className="font-medium">{EXEC_LABELS[h.to_status] || STATUS_LABELS[h.to_status] || h.to_status}</span>
                    {h.notes && <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{fmtDate(h.created_at)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ OBSERVAÇÕES ═══ */}
      {(p.notes || p.scope_description || address) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="w-4 h-4" /> Informações Adicionais
            </h3>
            {address && (
              <div>
                <p className="text-xs text-muted-foreground">Endereço</p>
                <p className="text-sm">{address}{location ? ` — ${location}` : ""}</p>
              </div>
            )}
            {p.scope_description && (
              <div>
                <p className="text-xs text-muted-foreground">Escopo</p>
                <p className="text-sm whitespace-pre-wrap">{p.scope_description}</p>
              </div>
            )}
            {p.notes && (
              <div>
                <p className="text-xs text-muted-foreground">Observações</p>
                <p className="text-sm whitespace-pre-wrap">{p.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        {icon}
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
