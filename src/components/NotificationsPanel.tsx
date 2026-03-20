import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, Info, AlertCircle, CheckCircle, ExternalLink } from "lucide-react";
import { useUnresolvedAlerts, useResolveAlert, useMarkAlertRead, type Alert } from "@/hooks/useAlerts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const PRIORITY_CONFIG = {
  urgente: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", badge: "🔴" },
  importante: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", badge: "🟡" },
  informacao: { icon: Info, color: "text-blue-600", bg: "bg-blue-50", badge: "🔵" },
};

export default function NotificationsPanel() {
  const { data: alerts = [] } = useUnresolvedAlerts();
  const resolveAlert = useResolveAlert();
  const markRead = useMarkAlertRead();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const unreadCount = alerts.filter((a) => !a.resolved).length;

  const handleAction = (alert: Alert) => {
    if (!alert.read) markRead.mutate(alert.id);
    if (alert.action_url) {
      navigate(alert.action_url);
      setOpen(false);
    }
  };

  const handleResolve = (e: React.MouseEvent, alert: Alert) => {
    e.stopPropagation();
    resolveAlert.mutate({ id: alert.id });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="relative p-2 rounded-lg hover:bg-muted transition-colors">
          <Bell className="w-5 h-5 text-muted-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[420px] p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Notificações</span>
          <span className="text-xs text-muted-foreground">{unreadCount} pendente(s)</span>
        </div>
        <ScrollArea className="max-h-[400px]">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação pendente</p>
          ) : (
            <div className="divide-y divide-border">
              {alerts.map((alert) => {
                const cfg = PRIORITY_CONFIG[alert.priority] ?? PRIORITY_CONFIG.informacao;
                const Icon = cfg.icon;
                return (
                  <div
                    key={alert.id}
                    className="flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors"
                  >
                    <div className={`mt-0.5 p-1.5 rounded-md ${cfg.bg} shrink-0`}>
                      <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px]">{cfg.badge}</span>
                        <p className="text-sm font-semibold text-foreground truncate">{alert.title}</p>
                      </div>
                      {alert.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.message}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                      <div className="flex gap-1.5 mt-2">
                        {alert.action_url && alert.action_label && (
                          <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => handleAction(alert)}>
                            <ExternalLink className="w-3 h-3 mr-1" />
                            {alert.action_label}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] px-2" onClick={(e) => handleResolve(e, alert)}>
                          <CheckCircle className="w-3 h-3 mr-1" /> Resolver
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
