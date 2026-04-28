import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  Building2,
  UserCheck,
  Network,
  CalendarClock,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  useComplianceSummary,
  EMPRESA_LABELS,
  type Severity,
  type VencimentoUnificado,
} from "@/hooks/useComplianceSummary";
import { DOC_TYPE_LABELS } from "@/hooks/useEmployeeDocuments";
import { useCompleteExecution } from "@/hooks/useComplianceTasks";

const SEVERITY_STYLES: Record<
  Severity,
  { gradient: string; iconBg: string; iconColor: string; label: string }
> = {
  ok: {
    gradient: "from-emerald-400 to-emerald-600",
    iconBg: "bg-emerald-100 dark:bg-emerald-900",
    iconColor: "text-emerald-600",
    label: "ok",
  },
  alerta: {
    gradient: "from-amber-400 to-amber-600",
    iconBg: "bg-amber-100 dark:bg-amber-900",
    iconColor: "text-amber-600",
    label: "alerta",
  },
  critico: {
    gradient: "from-red-400 to-red-600",
    iconBg: "bg-red-100 dark:bg-red-900",
    iconColor: "text-red-600",
    label: "crítico",
  },
};

const ORIGEM_LABEL: Record<VencimentoUnificado["origem"], string> = {
  empresa: "Doc empresa",
  funcionario: "Doc funcionário",
  integracao: "Integração",
};

function ComplianceKpiCard({
  icon,
  label,
  value,
  total,
  subtitle,
  severity,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  total: number | null;
  subtitle: string;
  severity: Severity;
  onClick: () => void;
}) {
  const styles = SEVERITY_STYLES[severity];
  return (
    <Card
      onClick={onClick}
      className="cursor-pointer transition-all hover:shadow-lg hover:-translate-y-0.5 overflow-hidden relative"
    >
      <div
        className={cn(
          "absolute top-0 left-0 right-0 h-1 bg-gradient-to-r",
          styles.gradient,
        )}
      />
      <CardContent className="p-4 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground mb-1">
              {label}
            </p>
            <p className="text-4xl font-extrabold tracking-tight leading-none">
              {value}
              {total !== null && (
                <span className="text-lg font-medium text-muted-foreground">
                  {" "}
                  / {total}
                </span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-tight">
              {subtitle}
            </p>
          </div>
          <div
            className={cn("p-2.5 rounded-xl shrink-0", styles.iconBg, styles.iconColor)}
          >
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function VencimentosColumn({
  title,
  items,
}: {
  title: string;
  items: VencimentoUnificado[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span>{title}</span>
          <Badge variant="secondary">{items.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nada nesta janela.</p>
        ) : (
          items.slice(0, 8).map((v) => {
            const docLabel = v.doc_type ? DOC_TYPE_LABELS[v.doc_type] ?? v.doc_type : "Integração";
            const subject =
              v.origem === "empresa"
                ? EMPRESA_LABELS[v.empresa ?? ""] ?? v.empresa ?? "—"
                : v.origem === "funcionario"
                  ? v.funcionario_nome ?? "—"
                  : `${v.funcionario_nome ?? "—"} → ${v.cliente_nome ?? "—"}`;
            const overdue = v.days_until < 0;
            return (
              <div
                key={`${v.origem}-${v.id}`}
                className="flex items-start justify-between gap-2 p-2 rounded border"
              >
                <div className="min-w-0">
                  <p className="text-xs font-medium truncate">{docLabel}</p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {ORIGEM_LABEL[v.origem]} · {subject}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {format(parseISO(v.expiry_date), "dd/MM/yyyy", { locale: ptBR })}
                  </p>
                </div>
                <Badge
                  className={cn(
                    "shrink-0",
                    overdue
                      ? "bg-red-600 text-white"
                      : v.days_until <= 30
                        ? "bg-amber-500 text-white"
                        : "bg-blue-500 text-white",
                  )}
                >
                  {overdue ? `${-v.days_until}d atraso` : `+${v.days_until}d`}
                </Badge>
              </div>
            );
          })
        )}
        {items.length > 8 && (
          <p className="text-[11px] text-muted-foreground">
            …e mais {items.length - 8}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ComplianceRadar() {
  const navigate = useNavigate();
  const { data: summary, isLoading } = useComplianceSummary();
  const complete = useCompleteExecution();
  const [activeWindow, setActiveWindow] = useState<"30" | "60" | "90">("30");

  if (isLoading || !summary) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  const window30 = summary.vencimentos.filter((v) => v.days_until <= 30);
  const window60 = summary.vencimentos.filter((v) => v.days_until > 30 && v.days_until <= 60);
  const window90 = summary.vencimentos.filter((v) => v.days_until > 60 && v.days_until <= 90);

  return (
    <div className="space-y-6">
      {/* ── Seção 1 — KPIs semafóricos ─────────────────────────────────── */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <ComplianceKpiCard
          icon={<Building2 className="w-5 h-5" />}
          label="Documentos da empresa"
          value={summary.empresa.vencidos}
          total={summary.empresa.total}
          subtitle={`${summary.empresa.vencendo30d} vencendo em 30d`}
          severity={summary.semaforo.empresa}
          onClick={() => navigate("/base/governanca")}
        />
        <ComplianceKpiCard
          icon={<UserCheck className="w-5 h-5" />}
          label="Documentos de funcionários"
          value={summary.funcionarios.vencidos}
          total={summary.funcionarios.total}
          subtitle={`${summary.funcionarios.vencendo30d} vencendo em 30d`}
          severity={summary.semaforo.funcionarios}
          onClick={() => navigate("/compliance/funcionarios")}
        />
        <ComplianceKpiCard
          icon={<Network className="w-5 h-5" />}
          label="Integrações por cliente"
          value={summary.integracoesCliente.vencidas}
          total={summary.integracoesCliente.total}
          subtitle={`${summary.integracoesCliente.vencendo30d} vencendo em 30d`}
          severity={summary.semaforo.integracoes}
          onClick={() => navigate("/compliance/clientes")}
        />
        <ComplianceKpiCard
          icon={<CalendarClock className="w-5 h-5" />}
          label="Tarefas atrasadas"
          value={summary.tarefasMensais.pendentes}
          total={null}
          subtitle={`${summary.tarefasMensais.proximas7d} nos próximos 7 dias`}
          severity={summary.semaforo.tarefas}
          onClick={() => navigate("/compliance/calendario")}
        />
      </div>

      {/* ── Seção 2 — Vencimentos próximos ─────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-semibold">Vencimentos próximos</h2>
          <Tabs value={activeWindow} onValueChange={(v) => setActiveWindow(v as "30" | "60" | "90")}>
            <TabsList>
              <TabsTrigger value="30">Até 30d</TabsTrigger>
              <TabsTrigger value="60">31–60d</TabsTrigger>
              <TabsTrigger value="90">61–90d</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <Tabs value={activeWindow}>
          <TabsContent value="30">
            <VencimentosColumn title="Até 30 dias" items={window30} />
          </TabsContent>
          <TabsContent value="60">
            <VencimentosColumn title="31 a 60 dias" items={window60} />
          </TabsContent>
          <TabsContent value="90">
            <VencimentosColumn title="61 a 90 dias" items={window90} />
          </TabsContent>
        </Tabs>
      </div>

      {/* ── Seção 3 — Tarefas mensais atrasadas ────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold mb-2">Tarefas mensais atrasadas</h2>
        <Card>
          <CardContent className="p-0">
            {summary.tarefasAtrasadas.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4">
                Nenhuma tarefa em atraso.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Tarefa</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Atraso</TableHead>
                    <TableHead className="text-right">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary.tarefasAtrasadas.map((t) => {
                    const refMonth = `${t.reference_year}-${String(t.reference_month).padStart(2, "0")}-01`;
                    return (
                      <TableRow key={t.id}>
                        <TableCell>{t.cliente_nome ?? "—"}</TableCell>
                        <TableCell>{t.task_title}</TableCell>
                        <TableCell>
                          {format(parseISO(t.due_date), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-red-600 text-white">
                            {t.days_overdue}d
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            onClick={async () => {
                              try {
                                await complete.mutateAsync({
                                  id: t.id,
                                  referenceMonth: refMonth,
                                });
                                toast.success("Tarefa concluída");
                              } catch (e) {
                                toast.error(
                                  e instanceof Error ? e.message : "Erro",
                                );
                              }
                            }}
                            disabled={complete.isPending}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Concluir
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
