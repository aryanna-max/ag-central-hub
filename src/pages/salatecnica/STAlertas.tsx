import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ExternalLink, Check, Clock, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface AlertRow {
  id: string;
  tipo: string | null;
  message: string | null;
  title: string;
  priority: string;
  alert_status: string | null;
  created_at: string;
  action_url: string | null;
  scheduled_at: string | null;
  reference_id: string | null;
}

export default function STAlertas() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [filterStatus, setFilterStatus] = useState("ativo");
  const [filterPriority, setFilterPriority] = useState("all");
  const [resolveId, setResolveId] = useState<string | null>(null);
  const [resolveNote, setResolveNote] = useState("");
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [scheduleDate, setScheduleDate] = useState<Date | null>(null);
  const [ignoreId, setIgnoreId] = useState<string | null>(null);
  const [ignoreReason, setIgnoreReason] = useState("");

  const { data: alerts = [], refetch } = useQuery({
    queryKey: ["st_alerts", filterStatus],
    queryFn: async () => {
      const base = supabase
        .from("alerts")
        .select("id, tipo, message, title, priority, alert_status, created_at, action_url, scheduled_at, reference_id")
        .eq("recipient", "sala_tecnica")
        .order("created_at", { ascending: false });

      const q = filterStatus !== "all"
        ? (base as any).eq("alert_status", filterStatus)
        : base;

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as AlertRow[];
    },
  });

  const filtered = useMemo(() => {
    if (filterPriority === "all") return alerts;
    return alerts.filter(a => a.priority === filterPriority);
  }, [alerts, filterPriority]);

  const urgentAlerts = filtered.filter(a => a.priority === "urgente" && a.alert_status === "ativo");
  const importantAlerts = filtered.filter(a => a.priority === "importante" && a.alert_status === "ativo");
  const otherAlerts = filtered.filter(a => !(a.priority === "urgente" && a.alert_status === "ativo") && !(a.priority === "importante" && a.alert_status === "ativo"));

  const patchAlert = async (id: string, updates: Record<string, any>) => {
    await supabase.from("alerts").update(updates as any).eq("id", id);
    refetch();
    qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  const handleResolve = async () => {
    if (!resolveId) return;
    await patchAlert(resolveId, { alert_status: "resolvido", resolved: true, resolved_at: new Date().toISOString() });
    toast.success("Alerta marcado como resolvido");
    setResolveId(null);
    setResolveNote("");
  };

  const handleSchedule = async () => {
    if (!scheduleId || !scheduleDate) return;
    await patchAlert(scheduleId, { alert_status: "agendado", scheduled_at: scheduleDate.toISOString() });
    toast.success("Alerta agendado");
    setScheduleId(null);
    setScheduleDate(null);
  };

  const handleIgnore = async () => {
    if (!ignoreId || !ignoreReason.trim()) return;
    await patchAlert(ignoreId, { alert_status: "ignorado" });
    toast.info("Alerta ignorado");
    setIgnoreId(null);
    setIgnoreReason("");
  };

  const AlertCard = ({ alert }: { alert: AlertRow }) => {
    const isUrgent = alert.priority === "urgente" && alert.alert_status === "ativo";
    const isImportant = alert.priority === "importante" && alert.alert_status === "ativo";
    return (
      <Card className={cn(
        isUrgent && "border-destructive bg-destructive/5",
        isImportant && "border-yellow-400 bg-yellow-50/50",
      )}>
        <CardContent className="p-3 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              {alert.tipo && <Badge variant="outline" className="text-[10px]">{alert.tipo}</Badge>}
              <Badge variant={alert.priority === "urgente" ? "destructive" : "secondary"} className="text-[10px]">
                {alert.priority}
              </Badge>
            </div>
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
            </span>
          </div>
          <p className="text-sm">{alert.message || alert.title}</p>
          {alert.alert_status === "ativo" && (
            <div className="flex gap-1.5 flex-wrap pt-1">
              {alert.action_url && (
                <Button size="sm" variant="default" className="h-7 text-xs" onClick={() => navigate(alert.action_url!)}>
                  <ExternalLink className="w-3 h-3 mr-0.5" /> Ir agora
                </Button>
              )}
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setResolveId(alert.id)}>
                <Check className="w-3 h-3 mr-0.5" /> Concluído
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setScheduleId(alert.id)}>
                <Clock className="w-3 h-3 mr-0.5" /> Agendar
              </Button>
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setIgnoreId(alert.id)}>
                <XCircle className="w-3 h-3 mr-0.5" /> Ignorar
              </Button>
            </div>
          )}
          {alert.alert_status === "agendado" && alert.scheduled_at && (
            <p className="text-[10px] text-muted-foreground">Agendado para {format(new Date(alert.scheduled_at), "dd/MM/yyyy HH:mm")}</p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativos</SelectItem>
            <SelectItem value="resolvido">Resolvidos</SelectItem>
            <SelectItem value="agendado">Agendados</SelectItem>
            <SelectItem value="ignorado">Ignorados</SelectItem>
            <SelectItem value="all">Todos</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterPriority} onValueChange={setFilterPriority}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas prioridades</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
            <SelectItem value="importante">Importante</SelectItem>
            <SelectItem value="informacao">Informação</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {urgentAlerts.map(a => <AlertCard key={a.id} alert={a} />)}
      {importantAlerts.map(a => <AlertCard key={a.id} alert={a} />)}
      {otherAlerts.map(a => <AlertCard key={a.id} alert={a} />)}
      {!filtered.length && <p className="text-sm text-muted-foreground text-center py-8">Nenhum alerta encontrado</p>}

      {/* Resolve */}
      <Dialog open={!!resolveId} onOpenChange={() => setResolveId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Marcar como concluído</DialogTitle></DialogHeader>
          <Textarea placeholder="Observação (opcional)" value={resolveNote} onChange={e => setResolveNote(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveId(null)}>Cancelar</Button>
            <Button onClick={handleResolve}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule */}
      <Dialog open={!!scheduleId} onOpenChange={() => setScheduleId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Agendar alerta</DialogTitle></DialogHeader>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-full justify-start text-left", !scheduleDate && "text-muted-foreground")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {scheduleDate ? format(scheduleDate, "dd/MM/yyyy") : "Selecione a data..."}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={scheduleDate || undefined} onSelect={d => setScheduleDate(d || null)} className="p-3 pointer-events-auto" /></PopoverContent>
          </Popover>
          <DialogFooter>
            <Button variant="outline" onClick={() => setScheduleId(null)}>Cancelar</Button>
            <Button onClick={handleSchedule} disabled={!scheduleDate}>Agendar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ignore */}
      <Dialog open={!!ignoreId} onOpenChange={() => setIgnoreId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ignorar alerta</DialogTitle></DialogHeader>
          <Textarea placeholder="Motivo (obrigatório)" value={ignoreReason} onChange={e => setIgnoreReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIgnoreId(null)}>Cancelar</Button>
            <Button onClick={handleIgnore} disabled={!ignoreReason.trim()}>Ignorar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
