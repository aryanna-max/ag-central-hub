import { useMemo } from "react";
import {
  BarChart3, TrendingUp, Users, FileText, FolderKanban,
  DollarSign, Clock, CheckCircle2, CheckCircle, Undo2, Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell,
} from "recharts";
import { useEmployees } from "@/hooks/useEmployees";
import { useExpenseSheets, useUpdateExpenseSheetStatus } from "@/hooks/useExpenseSheets";
import { useAlerts, useCreateAlerts, useResolveAlert, type Alert, type AlertInsert } from "@/hooks/useAlerts";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

const kpis = [
  { label: "Leads Ativos", value: "47", icon: Users, change: "+12%", color: "text-primary" },
  { label: "Propostas Abertas", value: "18", icon: FileText, change: "+5%", color: "text-secondary" },
  { label: "Projetos em Andamento", value: "12", icon: FolderKanban, change: "+3", color: "text-accent" },
  { label: "Faturamento Mensal", value: "R$ 285k", icon: DollarSign, change: "+8%", color: "text-primary" },
];

const monthlyData = [
  { mes: "Out", propostas: 14, projetos: 8 },
  { mes: "Nov", propostas: 19, projetos: 11 },
  { mes: "Dez", propostas: 12, projetos: 7 },
  { mes: "Jan", propostas: 22, projetos: 14 },
  { mes: "Fev", propostas: 17, projetos: 10 },
  { mes: "Mar", propostas: 24, projetos: 15 },
];

const serviceData = [
  { name: "Levantamento Topográfico", value: 35 },
  { name: "Georreferenciamento", value: 25 },
  { name: "Locação de Obras", value: 20 },
  { name: "Cartografia", value: 12 },
  { name: "Outros", value: 8 },
];

const PIE_COLORS = [
  "hsl(199, 65%, 30%)", "hsl(174, 100%, 29%)", "hsl(78, 62%, 44%)",
  "hsl(0, 0%, 48%)", "hsl(199, 65%, 45%)",
];

const recentActivities = [
  { text: "Nova proposta enviada para Construtora Alpha", time: "há 15 min", icon: FileText },
  { text: "Projeto PRJ-0034 concluído", time: "há 1h", icon: CheckCircle2 },
  { text: "Lead qualificado: Prefeitura de Olinda", time: "há 2h", icon: TrendingUp },
  { text: "Equipe A escalada para campo amanhã", time: "há 3h", icon: Clock },
  { text: "Pagamento recebido - NF 1247", time: "há 4h", icon: DollarSign },
];

export default function Dashboard() {
  const { data: employees = [] } = useEmployees();
  const { data: sheets = [] } = useExpenseSheets();
  const { data: allAlerts = [] } = useAlerts();
  const updateStatus = useUpdateExpenseSheetStatus();
  const createAlerts = useCreateAlerts();
  const resolveAlert = useResolveAlert();
  const { toast } = useToast();
  const [returnSheetId, setReturnSheetId] = useState<string | null>(null);
  const [returnComment, setReturnComment] = useState("");

  // Detect if current user is Sérgio/Ciro/Diretor
  const isApprover = useMemo(() => {
    // Since no auth, show for all — in production filter by logged-in user
    return true;
  }, []);

  // Detect if current user is Alcione/Financeiro
  const isFinanceiro = useMemo(() => {
    return true;
  }, []);

  const submittedSheets = sheets.filter((s) => s.status === "submetido");

  // Alcione's tasks: unresolved alerts assigned to financeiro
  const financeiroAlerts = useMemo(() => {
    return allAlerts.filter((a: Alert) =>
      !a.resolved && a.recipient === "financeiro"
    );
  }, [allAlerts]);

  const handleApprove = async (sheetId: string) => {
    const sheet = sheets.find((s) => s.id === sheetId);
    try {
      await updateStatus.mutateAsync({ id: sheetId, status: "aprovado" });
      await createAlerts.mutateAsync([{
        alert_type: "despesa_campo",
        recipient: "operacional",
        priority: "importante",
        title: `✅ Folha ${sheet?.week_label ?? ""} aprovada por Sérgio.`,
        message: `Total: ${(Number(sheet?.total_value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        reference_type: "expense_sheet",
        reference_id: sheetId,
        action_type: "visualizar",
        action_url: "/operacional/despesas-de-campo",
        action_label: "Ver folha",
      } as AlertInsert]);
      toast({ title: `Folha ${sheet?.week_label} aprovada!` });
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleReturn = async () => {
    if (!returnSheetId || !returnComment.trim()) {
      return toast({ title: "Informe o motivo", variant: "destructive" });
    }
    const sheet = sheets.find((s) => s.id === returnSheetId);
    try {
      await updateStatus.mutateAsync({ id: returnSheetId, status: "devolvido", return_comment: returnComment });
      await createAlerts.mutateAsync([{
        alert_type: "despesa_campo",
        recipient: "operacional",
        priority: "urgente",
        title: `Folha ${sheet?.week_label ?? ""} devolvida`,
        message: returnComment,
        reference_type: "expense_sheet",
        reference_id: returnSheetId,
        action_type: "visualizar",
        action_url: "/operacional/despesas-de-campo",
        action_label: "Ver folha",
      } as AlertInsert]);
      toast({ title: `Folha devolvida` });
      setReturnSheetId(null);
      setReturnComment("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleResolveFinanceiroAlert = async (alert: Alert) => {
    resolveAlert.mutate({ id: alert.id });
    toast({ title: "Tarefa resolvida" });
  };

  const actionTypeLabels: Record<string, { label: string; emoji: string }> = {
    conferir_recibo: { label: "Conferir NF/Recibo", emoji: "📄" },
    marcar_pago: { label: "Marcar como Pago", emoji: "💰" },
    emitir_nf: { label: "Emitir NF", emoji: "🧾" },
    visualizar: { label: "Visualizar", emoji: "👁" },
    aprovar: { label: "Aprovar", emoji: "✅" },
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral do sistema AG Topografia</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Card key={kpi.label}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{kpi.label}</p>
                    <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                    <p className="text-xs text-secondary mt-1 font-medium">{kpi.change} este mês</p>
                  </div>
                  <div className={`p-2.5 rounded-lg bg-muted ${kpi.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Approval Queue — Sérgio */}
      {isApprover && submittedSheets.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Pendentes de Aprovação
              <Badge variant="secondary" className="text-xs">{submittedSheets.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {submittedSheets.map((sheet) => (
                <div key={sheet.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{sheet.week_label}</span>
                      <Badge variant="secondary" className="text-[10px]">Submetido</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Total: {(Number(sheet.total_value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-emerald-700 hover:bg-emerald-800 text-white h-7 text-xs"
                      onClick={() => handleApprove(sheet.id)} disabled={updateStatus.isPending}>
                      <CheckCircle className="w-3 h-3 mr-1" /> Aprovar
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs"
                      onClick={() => setReturnSheetId(sheet.id)}>
                      <Undo2 className="w-3 h-3 mr-1" /> Devolver
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Financial Tasks — Alcione */}
      {isFinanceiro && financeiroAlerts.length > 0 && (
        <Card className="border-blue-300 dark:border-blue-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-blue-600" />
              Tarefas Financeiras
              <Badge variant="secondary" className="text-xs">{financeiroAlerts.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {financeiroAlerts.map((alert) => {
                const atl = actionTypeLabels[alert.action_type ?? ""] ?? { label: "Ação", emoji: "📌" };
                return (
                  <div key={alert.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{atl.emoji}</span>
                        <p className="text-sm font-medium truncate">{alert.title}</p>
                        <Badge variant={alert.priority === "urgente" ? "destructive" : "secondary"} className="text-[10px]">
                          {alert.priority === "urgente" ? "🔴 Alta" : "🟡 Média"}
                        </Badge>
                      </div>
                      {alert.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{alert.message}</p>
                      )}
                    </div>
                    <div className="flex gap-1.5 shrink-0 ml-2">
                      <Button size="sm" variant="outline" className="h-7 text-xs"
                        onClick={() => handleResolveFinanceiroAlert(alert)}>
                        <CheckCircle className="w-3 h-3 mr-1" /> {atl.label}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Propostas vs Projetos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(210, 18%, 87%)" />
                <XAxis dataKey="mes" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="propostas" fill="hsl(199, 65%, 30%)" radius={[4, 4, 0, 0]} name="Propostas" />
                <Bar dataKey="projetos" fill="hsl(174, 100%, 29%)" radius={[4, 4, 0, 0]} name="Projetos" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Serviços por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={serviceData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                  {serviceData.map((_, idx) => (
                    <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-1.5 mt-2">
              {serviceData.map((s, idx) => (
                <div key={s.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[idx] }} />
                    <span className="text-muted-foreground">{s.name}</span>
                  </div>
                  <span className="font-medium">{s.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Atividade Recente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {recentActivities.map((act, idx) => {
              const Icon = act.icon;
              return (
                <div key={idx} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
                  <div className="p-2 rounded-lg bg-muted">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{act.text}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{act.time}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Return dialog */}
      <Dialog open={!!returnSheetId} onOpenChange={() => { setReturnSheetId(null); setReturnComment(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Devolver Folha</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Motivo da Devolução *</Label>
            <Textarea value={returnComment} onChange={(e) => setReturnComment(e.target.value)} placeholder="Descreva o motivo..." />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReturnSheetId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleReturn} disabled={updateStatus.isPending}>Confirmar Devolução</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
