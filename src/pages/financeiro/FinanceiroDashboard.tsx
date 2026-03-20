import { useMemo } from "react";
import {
  DollarSign, CheckCircle, Clock, Undo2, Eye,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useExpenseSheets, useUpdateExpenseSheetStatus } from "@/hooks/useExpenseSheets";
import { useAlerts, useCreateAlerts, useResolveAlert, type Alert, type AlertInsert } from "@/hooks/useAlerts";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

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

  const submittedSheets = sheets.filter((s) => s.status === "submetido");

  const financeiroAlerts = useMemo(() => {
    return allAlerts.filter((a: Alert) => !a.resolved && a.recipient === "financeiro");
  }, [allAlerts]);

  const pendingCount = financeiroAlerts.length + submittedSheets.length;

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

  const handleResolveAlert = (alert: Alert) => {
    resolveAlert.mutate({ id: alert.id });
    toast({ title: "Tarefa resolvida" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Financeiro</h1>
        <p className="text-muted-foreground text-sm">
          Tarefas pendentes e acompanhamento financeiro
        </p>
      </div>

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
