import { useMemo, useState } from "react";
import {
  DollarSign, CheckCircle, Clock, Undo2, Filter, FileText,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useExpenseSheets, useUpdateExpenseSheetStatus } from "@/hooks/useExpenseSheets";
import { useCreateAlerts, useResolveAlert, type AlertInsert } from "@/hooks/useAlerts";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const billingLabels: Record<string, { label: string; color: string }> = {
  medicao_mensal: { label: "Medição Mensal", color: "bg-blue-100 text-blue-800 border-blue-200" },
  entrega_nf: { label: "NF na Entrega", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  entrega_recibo: { label: "Recibo na Entrega", color: "bg-amber-100 text-amber-800 border-amber-200" },
};

interface EnrichedAlert {
  id: string;
  title: string;
  message: string | null;
  priority: string;
  action_url: string | null;
  action_type: string | null;
  resolved: boolean;
  resolved_at: string | null;
  created_at: string;
  reference_id: string | null;
  alert_status: string | null;
  project_codigo: string | null;
  project_name: string | null;
  cnpj_tomador: string | null;
  empresa_faturadora: string | null;
  delivered_at: string | null;
  billing_type: string | null;
  contract_value: number | null;
  client_name: string | null;
}

export default function FaturamentoAlertas() {
  const { data: sheets = [] } = useExpenseSheets();
  const updateStatus = useUpdateExpenseSheetStatus();
  const createAlerts = useCreateAlerts();
  const resolveAlert = useResolveAlert();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [returnSheetId, setReturnSheetId] = useState<string | null>(null);
  const [returnComment, setReturnComment] = useState("");
  const [resolveAlertId, setResolveAlertId] = useState<string | null>(null);
  const [docNumber, setDocNumber] = useState("");
  const [subtab, setSubtab] = useState("pendentes");

  const submittedSheets = sheets.filter((s) => s.status === "submetido");

  // Enriched alerts with project + client data
  const { data: enrichedAlerts = [] } = useQuery({
    queryKey: ["faturamento-alerts-enriched"],
    queryFn: async () => {
      const { data: alertsData, error: alertsErr } = await supabase
        .from("alerts")
        .select("*")
        .eq("recipient", "financeiro")
        .order("created_at", { ascending: false });
      if (alertsErr) throw alertsErr;

      const alerts = alertsData || [];
      if (alerts.length === 0) return [];

      const refIds = alerts
        .map((a: any) => a.reference_id)
        .filter(Boolean) as string[];

      let projectsMap: Record<string, any> = {};
      let clientsMap: Record<string, any> = {};

      if (refIds.length > 0) {
        const { data: projects } = await supabase
          .from("projects")
          .select("id, codigo, name, cnpj_tomador, empresa_faturadora, delivered_at, billing_type, contract_value, client_id")
          .in("id", refIds);

        (projects || []).forEach((p: any) => {
          projectsMap[p.id] = p;
        });

        const clientIds = (projects || [])
          .map((p: any) => p.client_id)
          .filter(Boolean) as string[];

        if (clientIds.length > 0) {
          const { data: clients } = await supabase
            .from("clients")
            .select("id, name")
            .in("id", clientIds);
          (clients || []).forEach((c: any) => {
            clientsMap[c.id] = c;
          });
        }
      }

      return alerts.map((a: any): EnrichedAlert => {
        const proj = a.reference_id ? projectsMap[a.reference_id] : null;
        const client = proj?.client_id ? clientsMap[proj.client_id] : null;
        return {
          id: a.id,
          title: a.title,
          message: a.message,
          priority: a.priority,
          action_url: a.action_url,
          action_type: a.action_type,
          resolved: a.resolved,
          resolved_at: a.resolved_at,
          created_at: a.created_at,
          reference_id: a.reference_id,
          alert_status: a.alert_status,
          project_codigo: proj?.codigo || null,
          project_name: proj?.name || null,
          cnpj_tomador: proj?.cnpj_tomador || null,
          empresa_faturadora: proj?.empresa_faturadora || null,
          delivered_at: proj?.delivered_at || null,
          billing_type: proj?.billing_type || null,
          contract_value: proj?.contract_value != null ? Number(proj.contract_value) : null,
          client_name: client?.name || null,
        };
      });
    },
    refetchInterval: 30000,
  });

  const pendingAlerts = enrichedAlerts.filter((a) => !a.resolved);
  const resolvedAlerts = enrichedAlerts.filter((a) => a.resolved);

  const displayedAlerts = subtab === "pendentes"
    ? pendingAlerts
    : subtab === "resolvidos"
      ? resolvedAlerts
      : enrichedAlerts;

  const pendingCount = pendingAlerts.length + submittedSheets.length;

  // Expense sheet handlers
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
      toast({ title: "Folha devolvida" });
      setReturnSheetId(null);
      setReturnComment("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const handleResolveAlert = async () => {
    if (!resolveAlertId || !docNumber.trim()) {
      return toast({ title: "Informe o número do documento", variant: "destructive" });
    }
    try {
      const { error } = await supabase
        .from("alerts")
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          read: true,
          alert_status: "resolvido",
        } as any)
        .eq("id", resolveAlertId);
      if (error) throw error;
      toast({ title: `Documento ${docNumber} registrado` });
      setResolveAlertId(null);
      setDocNumber("");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const renderAlertCard = (alert: EnrichedAlert) => {
    const isResolved = alert.resolved;
    const billing = alert.billing_type ? billingLabels[alert.billing_type] : null;
    const borderColor = isResolved
      ? "border-l-muted"
      : alert.priority === "urgente"
        ? "border-l-orange-500"
        : "border-l-blue-500";

    return (
      <Card
        key={alert.id}
        className={`border-l-4 ${borderColor} ${isResolved ? "opacity-60" : ""}`}
      >
        <CardContent className="p-4 space-y-2">
          {/* Header action */}
          <div className="flex items-center justify-between">
            <Badge className="bg-primary/10 text-primary border-primary/20 font-bold text-sm">
              {alert.title}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>

          {/* Project info */}
          <div className="space-y-1">
            {(alert.project_codigo || alert.project_name) && (
              <p className="font-semibold text-sm">
                {alert.project_codigo && (
                  <span className="font-mono text-primary">{alert.project_codigo}</span>
                )}
                {alert.project_codigo && alert.project_name && " — "}
                {alert.project_name}
              </p>
            )}
            {alert.client_name && (
              <p className="text-sm text-muted-foreground">{alert.client_name}</p>
            )}
            {alert.cnpj_tomador && (
              <p className="text-xs text-muted-foreground">CNPJ: {alert.cnpj_tomador}</p>
            )}
            {alert.empresa_faturadora && (
              <p className="text-xs text-muted-foreground">
                Faturar por: {alert.empresa_faturadora === "ag_topografia" ? "AG Topografia" : "AG Cartografia"}
              </p>
            )}
            {alert.delivered_at && (
              <p className="text-xs text-muted-foreground">
                Entregue em: {format(new Date(alert.delivered_at), "dd/MM/yyyy")}
              </p>
            )}
            {alert.contract_value != null && alert.contract_value > 0 && (
              <p className="text-sm font-medium">
                Valor: {alert.contract_value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
              </p>
            )}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {billing && (
              <Badge variant="outline" className={`text-[10px] ${billing.color}`}>
                {billing.label}
              </Badge>
            )}
            {isResolved && alert.resolved_at && (
              <Badge variant="secondary" className="text-[10px]">
                Resolvido em {format(new Date(alert.resolved_at), "dd/MM/yyyy")}
              </Badge>
            )}
          </div>

          {/* Actions */}
          {!isResolved && (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="h-7 text-xs"
                onClick={() => { setResolveAlertId(alert.id); setDocNumber(""); }}
              >
                <CheckCircle className="w-3 h-3 mr-1" /> Marcar como emitido
              </Button>
              {alert.action_url && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => navigate(alert.action_url!)}
                >
                  Ver projeto
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
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
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Alertas Pendentes</p>
              <p className="text-2xl font-bold">{pendingAlerts.length}</p>
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

      {/* Expense sheets approval */}
      {submittedSheets.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              Folhas de Despesa — Aprovação
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

      {/* Alerts subtabs */}
      <Tabs value={subtab} onValueChange={setSubtab}>
        <TabsList>
          <TabsTrigger value="pendentes">Pendentes ({pendingAlerts.length})</TabsTrigger>
          <TabsTrigger value="resolvidos">Resolvidos ({resolvedAlerts.length})</TabsTrigger>
          <TabsTrigger value="todos">Todos ({enrichedAlerts.length})</TabsTrigger>
        </TabsList>

        <TabsContent value={subtab} className="space-y-3 mt-3">
          {displayedAlerts.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-muted-foreground">
                  {subtab === "pendentes" ? "Nenhum alerta pendente. Tudo em dia! 🎉" : "Nenhum alerta encontrado."}
                </p>
              </CardContent>
            </Card>
          ) : (
            displayedAlerts.map(renderAlertCard)
          )}
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

      {/* Resolve alert dialog */}
      <Dialog open={!!resolveAlertId} onOpenChange={() => { setResolveAlertId(null); setDocNumber(""); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Marcar como Emitido</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Label>Número do documento *</Label>
            <Input value={docNumber} onChange={(e) => setDocNumber(e.target.value)} placeholder="Ex: NF-2026-001" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveAlertId(null)}>Cancelar</Button>
            <Button onClick={handleResolveAlert} disabled={!docNumber.trim()}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
