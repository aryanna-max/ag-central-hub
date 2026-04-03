import { useMemo, useState } from "react";
import {
  DollarSign, CheckCircle, Clock, Undo2, Mail, RefreshCw, Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useExpenseSheets, useUpdateExpenseSheetStatus } from "@/hooks/useExpenseSheets";
import { useAlerts, useCreateAlerts, useResolveAlert, type Alert, type AlertInsert } from "@/hooks/useAlerts";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const actionTypeLabels: Record<string, { label: string; emoji: string }> = {
  conferir_recibo: { label: "Conferir NF/Recibo", emoji: "📄" },
  marcar_pago: { label: "Marcar como Pago", emoji: "💰" },
  emitir_nf: { label: "Emitir NF", emoji: "🧾" },
  visualizar: { label: "Visualizar", emoji: "👁" },
  aprovar: { label: "Aprovar", emoji: "✅" },
};

export default function FinanceiroDashboard() {
  const { data: sheets = [] } = useExpenseSheets();
  const { data: allAlerts = [] } = useAlerts();
  const updateStatus = useUpdateExpenseSheetStatus();
  const createAlerts = useCreateAlerts();
  const resolveAlert = useResolveAlert();
  const { toast } = useToast();
  const [returnSheetId, setReturnSheetId] = useState<string | null>(null);
  const [returnComment, setReturnComment] = useState("");
  const [alertStatusFilter, setAlertStatusFilter] = useState("todos");

  const submittedSheets = sheets.filter((s) => s.status === "submetido");

  const financeiroAlerts = useMemo(() => {
    return allAlerts.filter((a: Alert) => !a.resolved && a.recipient === "financeiro");
  }, [allAlerts]);

  // All financeiro alerts for log
  const { data: allFinanceiroAlerts = [] } = useQuery({
    queryKey: ["financeiro-alerts-log"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("recipient", "financeiro")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  // Email log
  const { data: emailLogs = [] } = useQuery({
    queryKey: ["email-send-log-financeiro"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  // Projects map for codes
  const { data: projectsMap = {} } = useQuery({
    queryKey: ["projects-map-fin"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, codigo, name");
      const map: Record<string, { codigo: string | null; name: string }> = {};
      (data || []).forEach((p) => { map[p.id] = { codigo: p.codigo, name: p.name }; });
      return map;
    },
  });

  const emailStatusByAlertId = useMemo(() => {
    const map: Record<string, boolean> = {};
    emailLogs.forEach((log: any) => {
      if (log.status === "sent") {
        // Try to match by metadata reference_id
        const meta = log.metadata as any;
        if (meta?.alert_id) map[meta.alert_id] = true;
      }
    });
    return map;
  }, [emailLogs]);

  const filteredAlertLog = useMemo(() => {
    return allFinanceiroAlerts.filter((a: any) => {
      if (alertStatusFilter === "ativo") return a.alert_status === "ativo";
      if (alertStatusFilter === "resolvido") return a.alert_status === "resolvido" || a.resolved;
      return true;
    });
  }, [allFinanceiroAlerts, alertStatusFilter]);

  const pendingCount = financeiroAlerts.length + submittedSheets.length;

  const handleApprove = async (sheetId: string) => {
    const sheet = sheets.find((s) => s.id === sheetId);
    try {
      await updateStatus.mutateAsync({ id: sheetId, status: "aprovado" });
      await createAlerts.mutateAsync([{
        alert_type: "despesa_campo",
        recipient: "operacional",
        priority: "importante",
        title: `✅ Folha ${sheet?.week_label ?? ""} aprovada.`,
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

  const handleResolveAlert = (alert: Alert) => {
    resolveAlert.mutate({ id: alert.id });
    toast({ title: "Tarefa resolvida" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Faturamento</h1>
        <p className="text-muted-foreground text-sm">
          Tarefas pendentes e acompanhamento financeiro
        </p>
      </div>

      <Tabs defaultValue="pendentes">
        <TabsList>
          <TabsTrigger value="pendentes">Pendências ({pendingCount})</TabsTrigger>
          <TabsTrigger value="alertas">Alertas Enviados</TabsTrigger>
        </TabsList>

        <TabsContent value="pendentes" className="space-y-6">
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-amber-100 text-amber-700">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Folhas p/ Aprovação</p>
                  <p className="text-2xl font-bold">{submittedSheets.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-blue-100 text-blue-700">
                  <DollarSign className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Tarefas Financeiras</p>
                  <p className="text-2xl font-bold">{financeiroAlerts.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="p-2.5 rounded-lg bg-emerald-100 text-emerald-700">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Pendente</p>
                  <p className="text-2xl font-bold">{pendingCount}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Approval Queue */}
          {submittedSheets.length > 0 && (
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

          {/* Financial Tasks */}
          {financeiroAlerts.length > 0 && (
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
                            onClick={() => handleResolveAlert(alert)}>
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

          {pendingCount === 0 && (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-muted-foreground">Nenhuma tarefa pendente. Tudo em dia! 🎉</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Alertas Enviados tab */}
        <TabsContent value="alertas" className="space-y-4">
          <div className="flex items-center gap-3">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={alertStatusFilter} onValueChange={setAlertStatusFilter}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="resolvido">Resolvidos</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="ml-auto">{filteredAlertLog.length} alertas</Badge>
          </div>

          <Card>
            <CardContent className="p-0">
              {filteredAlertLog.length === 0 ? (
                <p className="p-8 text-center text-muted-foreground">Nenhum alerta encontrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Projeto</TableHead>
                      <TableHead>Ação solicitada</TableHead>
                      <TableHead className="text-center">Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAlertLog.map((a: any) => {
                      const proj = a.reference_id ? projectsMap[a.reference_id] : null;
                      const emailSent = emailStatusByAlertId[a.id];
                      const isResolved = a.alert_status === "resolvido" || a.resolved;
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(a.created_at), "dd/MM/yyyy HH:mm")}
                          </TableCell>
                          <TableCell>
                            {proj ? (
                              <span className="font-mono text-sm font-semibold text-primary">{proj.codigo || proj.name}</span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-sm max-w-xs truncate">{a.message || a.title}</TableCell>
                          <TableCell className="text-center">
                            {emailSent === true ? (
                              <Badge className="bg-emerald-600 text-white text-[10px]">✅ Enviado</Badge>
                            ) : emailSent === false ? (
                              <Badge variant="destructive" className="text-[10px]">❌ Falha</Badge>
                            ) : (
                              <Badge variant="secondary" className="text-[10px]">—</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isResolved ? "secondary" : "default"} className="text-xs">
                              {isResolved ? "Resolvido" : "Ativo"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
