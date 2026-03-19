import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Bell, AlertTriangle, Info, AlertCircle, CheckCheck } from "lucide-react";
import { useAlerts, useUnreadAlertCount, useMarkAlertRead, useMarkAllAlertsRead, type Alert } from "@/hooks/useAlerts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const PRIORITY_CONFIG = {
  urgente: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
  importante: { icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50" },
  informacao: { icon: Info, color: "text-blue-600", bg: "bg-blue-50" },
};

export default function NotificationsPanel() {
  const { data: alerts = [] } = useAlerts();
  const { data: unreadCount = 0 } = useUnreadAlertCount();
  const markRead = useMarkAlertRead();
  const markAllRead = useMarkAllAlertsRead();
  const [open, setOpen] = useState(false);

  const handleClickAlert = (alert: Alert) => {
    if (!alert.read) {
      markRead.mutate(alert.id);
    }
    setOpen(false);
  };

  const handleMarkAllRead = () => {
    markAllRead.mutate();
    setOpen(false);
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
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <span className="text-sm font-semibold text-foreground">Notificações</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs h-7"
              onClick={() => markAllRead.mutate()}
            >
              <CheckCheck className="w-3.5 h-3.5 mr-1" /> Marcar todas como lidas
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {alerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Nenhuma notificação</p>
          ) : (
            <div className="divide-y divide-border">
              {alerts.map((alert) => {
                const cfg = PRIORITY_CONFIG[alert.priority];
                const Icon = cfg.icon;
                return (
                  <div
                    key={alert.id}
                    className={`flex gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                      !alert.read ? "bg-muted/30" : ""
                    }`}
                    onClick={() => handleClickAlert(alert)}
                  >
                    <div className={`mt-0.5 p-1.5 rounded-md ${cfg.bg} shrink-0`}>
                      <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-sm truncate ${!alert.read ? "font-semibold" : "font-medium"} text-foreground`}>
                          {alert.title}
                        </p>
                      </div>
                      {alert.message && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{alert.message}</p>
                      )}
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    </div>
                    {!alert.read && (
                      <div className="mt-2 w-2 h-2 rounded-full bg-primary shrink-0" />
                    )}
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
