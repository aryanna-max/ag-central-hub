import { useMemo, useState } from "react";
import {
  DollarSign, CheckCircle, Clock, Undo2, FileText, Eye,
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
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";

/* ── Billing type badge config ── */
const billingBadges: Record<string, { label: string; className: string }> = {
  entrega_nf: { label: "NF na entrega", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  entrega_recibo: { label: "Recibo", className: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  medicao_mensal: { label: "Por medição", className: "bg-blue-100 text-blue-800 border-blue-200" },
  misto: { label: "Misto", className: "bg-amber-100 text-amber-800 border-amber-200" },
  sem_documento: { label: "Sem documento", className: "bg-muted text-muted-foreground" },
};

/* ── Priority border colors ── */
const priorityBorder: Record<string, string> = {
  urgente: "border-l-destructive",
  importante: "border-l-orange-500",
  informacao: "border-l-blue-500",
};

const fmt = (v: number | null | undefined) =>
  v != null ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

/* ── Enriched alert type ── */
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
  reference_type: string | null;
  alert_status: string | null;
  project_codigo: string | null;
  project_name: string | null;
  cnpj_tomador: string | null;
  empresa_faturadora: string | null;
  delivered_at: string | null;
  billing_type: string | null;
  contract_value: number | null;
  client_name: string | null;
  client_id: string | null;
  /* full project data for sheet */
  project: any | null;
}

export default function FaturamentoAlertas() {
  const { data: sheets = [] } = useExpenseSheets();
  const updateStatus = useUpdateExpenseSheetStatus();
  const createAlerts = useCreateAlerts();
  const resolveAlert = useResolveAlert();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [returnSheetId, setReturnSheetId] = useState<string | null>(null);
  const [returnComment, setReturnComment] = useState("");
  const [subtab, setSubtab] = useState("pendentes");

  /* NF modal state */
  const [nfAlert, setNfAlert] = useState<EnrichedAlert | null>(null);
  const [nfNumero, setNfNumero] = useState("");
  const [nfData, setNfData] = useState<Date>(new Date());
  const [nfValor, setNfValor] = useState("");
  const [nfEmpresa, setNfEmpresa] = useState("ag_topografia");

  /* Project sheet state */
  const [sheetProject, setSheetProject] = useState<any | null>(null);

  const submittedSheets = sheets.filter((s) => s.status === "submetido");

  /* ── Enriched alerts query ── */
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
          .select("*,clients(id,name,cnpj)")
          .in("id", refIds);

        (projects || []).forEach((p: any) => {
          const proj = {
            ...p,
            clients: Array.isArray(p.clients) ? p.clients[0] || null : p.clients || null,
          };
          projectsMap[p.id] = proj;
        });

        const clientIds = (projects || [])
          .map((p: any) => Array.isArray(p.clients) ? p.clients[0]?.id : p.clients?.id || p.client_id)
          .filter(Boolean) as string[];

        if (clientIds.length > 0) {
          const { data: clients } = await supabase
            .from("clients")
            .select("id, name, cnpj")
            .in("id", [...new Set(clientIds)]);
          (clients || []).forEach((c: any) => {
            clientsMap[c.id] = c;
          });
        }
      }

      return alerts.map((a: any): EnrichedAlert => {
        const proj = a.reference_id ? projectsMap[a.reference_id] : null;
        const clientId = proj?.client_id;
        const client = clientId ? clientsMap[clientId] : null;
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
          reference_type: a.reference_type,
          alert_status: a.alert_status,
          project_codigo: proj?.codigo || null,
          project_name: proj?.name || null,
          cnpj_tomador: proj?.cnpj_tomador || null,
          empresa_faturadora: proj?.empresa_faturadora || null,
          delivered_at: proj?.delivered_at || null,
          billing_type: proj?.billing_type || null,
          contract_value: proj?.contract_value != null ? Number(proj.contract_value) : null,
          client_name: client?.name || proj?.clients?.name || null,
          client_id: clientId || null,
          project: proj || null,
        };
      });
    },
    refetchInterval: 30000,
  });

  /* sorted: resolved=false first, then by priority, then date */
  const sortedAlerts = useMemo(() => {
    const prioOrder: Record<string, number> = { urgente: 0, importante: 1, informacao: 2 };
    return [...enrichedAlerts].sort((a, b) => {
      if (a.resolved !== b.resolved) return a.resolved ? 1 : -1;
      const pa = prioOrder[a.priority] ?? 3;
      const pb = prioOrder[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [enrichedAlerts]);

  const pendingAlerts = sortedAlerts.filter((a) => !a.resolved);
  const resolvedAlerts = sortedAlerts.filter((a) => a.resolved);

  const displayedAlerts = subtab === "pendentes"
    ? pendingAlerts
    : subtab === "resolvidos"
      ? resolvedAlerts
      : sortedAlerts;

  /* ── Expense sheet handlers ── */
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

  /* ── NF Registration ── */
  const openNfModal = (alert: EnrichedAlert) => {
    setNfAlert(alert);
    setNfNumero("");
    setNfData(new Date());
    setNfValor(alert.contract_value?.toString() || "");
    setNfEmpresa(alert.empresa_faturadora || "ag_topografia");
  };

  const handleRegisterNf = async () => {
    if (!nfAlert || !nfNumero.trim()) {
      return toast({ title: "Informe o número da NF", variant: "destructive" });
    }
    try {
      // Resolve the alert
      const { error: alertErr } = await supabase
        .from("alerts")
        .update({
          resolved: true,
          resolved_at: new Date().toISOString(),
          read: true,
          alert_status: "resolvido",
        } as any)
        .eq("id", nfAlert.id);
      if (alertErr) throw alertErr;

      // Update project execution_status to 'faturamento' if currently 'entregue'
      if (nfAlert.reference_id && nfAlert.reference_type === "project") {
        const { data: proj } = await supabase
          .from("projects")
          .select("execution_status")
          .eq("id", nfAlert.reference_id)
          .single();
        if (proj && proj.execution_status === "entregue") {
          await supabase
            .from("projects")
            .update({ execution_status: "faturamento" } as any)
            .eq("id", nfAlert.reference_id);
        }
      }

      qc.invalidateQueries({ queryKey: ["faturamento-alerts-enriched"] });
      qc.invalidateQueries({ queryKey: ["alerts"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast({ title: `NF ${nfNumero} registrada com sucesso` });
      setNfAlert(null);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  /* ── Render alert card ── */
  const renderAlertCard = (alert: EnrichedAlert) => {
    const isResolved = alert.resolved;
    const billing = alert.billing_type ? billingBadges[alert.billing_type] : null;
    const border = isResolved
      ? "border-l-muted"
      : priorityBorder[alert.priority] || "border-l-blue-500";

    return (
      <Card
        key={alert.id}
        className={`border-l-4 ${border} ${isResolved ? "opacity-60" : ""}`}
      >
        <CardContent className="p-4 space-y-2">
          {/* Header */}
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-base text-foreground leading-tight">{alert.title}</p>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>

          {/* Detail message */}
          {alert.message && (
            <p className="text-sm text-muted-foreground">{alert.message}</p>
          )}

          {/* Project + Client info */}
          <div className="space-y-1 text-sm">
            {(alert.project_codigo || alert.project_name) && (
              <p>
                <span className="text-muted-foreground">Projeto: </span>
                {alert.project_codigo && (
                  <span className="font-mono font-semibold text-primary">{alert.project_codigo}</span>
                )}
                {alert.project_codigo && alert.project_name && " — "}
                <span className="font-medium">{alert.project_name}</span>
              </p>
            )}
            {alert.client_name && (
              <p>
                <span className="text-muted-foreground">Cliente: </span>
                <span className="font-medium">{alert.client_name}</span>
              </p>
            )}
            <p>
              <span className="text-muted-foreground">CNPJ Tomador: </span>
              <span>{alert.cnpj_tomador || "— não informado"}</span>
            </p>
            <p>
              <span className="text-muted-foreground">Empresa faturadora: </span>
              <span>{alert.empresa_faturadora === "ag_cartografia" ? "AG Cartografia" : "AG Topografia"}</span>
            </p>
            {alert.delivered_at && (
              <p>
                <span className="text-muted-foreground">Data entrega: </span>
                <span>{format(new Date(alert.delivered_at), "dd/MM/yyyy")}</span>
              </p>
            )}
            {alert.contract_value != null && alert.contract_value > 0 && (
              <p>
                <span className="text-muted-foreground">Valor: </span>
                <span className="font-semibold">{fmt(alert.contract_value)}</span>
              </p>
            )}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {billing && (
              <Badge variant="outline" className={`text-[10px] ${billing.className}`}>
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
                onClick={() => openNfModal(alert)}
              >
                <CheckCircle className="w-3 h-3 mr-1" /> Registrar NF emitida
              </Button>
              {alert.project && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={() => setSheetProject(alert.project)}
                >
                  <Eye className="w-3 h-3 mr-1" /> Ver projeto
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const proj = sheetProject;

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
            <div className="p-2.5 rounded-lg bg-destructive/10 text-destructive">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">NFs Pendentes</p>
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
              <p className="text-sm text-muted-foreground">Resolvidos</p>
              <p className="text-2xl font-bold">{resolvedAlerts.length}</p>
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
          <TabsTrigger value="todos">Todos ({sortedAlerts.length})</TabsTrigger>
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
            <DialogDescription>Informe o motivo para devolver esta folha de despesa.</DialogDescription>
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

      {/* NF Registration Modal */}
      <Dialog open={!!nfAlert} onOpenChange={() => setNfAlert(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar NF Emitida</DialogTitle>
            <DialogDescription>
              {nfAlert?.project_codigo && `${nfAlert.project_codigo} — `}{nfAlert?.project_name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Número da NF *</Label>
              <Input
                value={nfNumero}
                onChange={(e) => setNfNumero(e.target.value)}
                placeholder="Ex: NF-2026-001"
              />
            </div>
            <div>
              <Label>Data de emissão</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !nfData && "text-muted-foreground")}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {nfData ? format(nfData, "dd/MM/yyyy") : "Selecionar data"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={nfData}
                    onSelect={(d) => d && setNfData(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Valor da NF (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={nfValor}
                onChange={(e) => setNfValor(e.target.value)}
                placeholder="0,00"
              />
            </div>
            <div>
              <Label>Empresa faturadora</Label>
              <Select value={nfEmpresa} onValueChange={setNfEmpresa}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ag_topografia">AG Topografia</SelectItem>
                  <SelectItem value="ag_cartografia">AG Cartografia</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNfAlert(null)}>Cancelar</Button>
            <Button onClick={handleRegisterNf} disabled={!nfNumero.trim()}>
              <CheckCircle className="w-4 h-4 mr-1" /> Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Project Detail Sheet */}
      <Sheet open={!!sheetProject} onOpenChange={() => setSheetProject(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {proj?.codigo && <span className="font-mono text-primary mr-2">{proj.codigo}</span>}
              {proj?.name}
            </SheetTitle>
          </SheetHeader>
          {proj && (
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Cliente</p>
                  <p className="font-medium">{proj.clients?.name || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">CNPJ Tomador</p>
                  <p className="font-medium">{proj.cnpj_tomador || "— não informado"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Empresa Faturadora</p>
                  <p className="font-medium">
                    {proj.empresa_faturadora === "ag_cartografia" ? "AG Cartografia" : "AG Topografia"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Tipo Documento</p>
                  <p className="font-medium">
                    {proj.tipo_documento === "recibo" ? "Recibo" : "Nota Fiscal"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Modalidade</p>
                  <p className="font-medium">
                    {proj.billing_type ? (billingBadges[proj.billing_type]?.label || proj.billing_type) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Valor Contrato</p>
                  <p className="font-medium">{fmt(proj.contract_value)}</p>
                </div>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">Status Execução</p>
                  <p className="font-medium">{proj.execution_status || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Data Entrega</p>
                  <p className="font-medium">
                    {proj.delivered_at ? format(new Date(proj.delivered_at), "dd/MM/yyyy") : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Início Campo</p>
                  <p className="font-medium">
                    {proj.field_started_at ? format(new Date(proj.field_started_at), "dd/MM/yyyy") : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground">Campo Concluído</p>
                  <p className="font-medium">
                    {proj.field_completed_at ? format(new Date(proj.field_completed_at), "dd/MM/yyyy") : "—"}
                  </p>
                </div>
              </div>

              <Separator />

              <div className="text-sm space-y-2">
                <div>
                  <p className="text-muted-foreground">Conta Bancária</p>
                  <p className="font-medium">{proj.conta_bancaria || "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Referência Contrato</p>
                  <p className="font-medium">{proj.referencia_contrato || "—"}</p>
                </div>
                {proj.notes && (
                  <div>
                    <p className="text-muted-foreground">Observações</p>
                    <p className="font-medium">{proj.notes}</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
