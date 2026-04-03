import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { format, differenceInCalendarDays } from "date-fns";
import { cn } from "@/lib/utils";

interface DeadlineBadgeProps {
  deadline: Date | null;
  started_at: Date | null;
  estimated_days: number | null;
  completed_at: Date | null;
  label?: string;
}

type Status = "aguardando" | "ok" | "atencao" | "critico" | "vencido" | "concluido";

function getStatus(
  deadline: Date | null,
  started_at: Date | null,
  estimated_days: number | null,
  completed_at: Date | null,
): { status: Status; daysLeft: number; progress: number } {
  if (completed_at) return { status: "concluido", daysLeft: 0, progress: 100 };
  if (!started_at) return { status: "aguardando", daysLeft: 0, progress: 0 };

  const today = new Date();
  const totalDays = estimated_days || (deadline ? differenceInCalendarDays(deadline, started_at) : 0);
  const elapsed = differenceInCalendarDays(today, started_at);
  const progress = totalDays > 0 ? Math.min(100, Math.max(0, (elapsed / totalDays) * 100)) : 0;

  if (!deadline) return { status: "ok", daysLeft: 0, progress };

  const daysLeft = differenceInCalendarDays(deadline, today);

  if (daysLeft < 0) return { status: "vencido", daysLeft, progress: 100 };

  const remaining = totalDays > 0 ? daysLeft / totalDays : 1;
  if (remaining < 0.2) return { status: "critico", daysLeft, progress };
  if (remaining < 0.4) return { status: "atencao", daysLeft, progress };
  return { status: "ok", daysLeft, progress };
}

const statusStyles: Record<Status, { bar: string; badge: string }> = {
  vencido:    { bar: "bg-[#dc2626]", badge: "border-destructive/30 bg-destructive/10 text-destructive" },
  critico:    { bar: "bg-[#f97316]", badge: "border-orange-300 bg-orange-50 text-orange-700" },
  atencao:    { bar: "bg-[#F5C518]", badge: "border-yellow-300 bg-yellow-50 text-yellow-700" },
  ok:         { bar: "bg-[#1A9E7C]", badge: "border-emerald-300 bg-emerald-50 text-emerald-700" },
  aguardando: { bar: "bg-[#64748b]", badge: "border-border bg-muted text-muted-foreground" },
  concluido:  { bar: "bg-[#1A9E7C]", badge: "border-emerald-300 bg-emerald-50 text-emerald-700" },
};

export default function DeadlineBadge({ deadline, started_at, estimated_days, completed_at, label }: DeadlineBadgeProps) {
  const { status, daysLeft, progress } = useMemo(
    () => getStatus(deadline, started_at, estimated_days, completed_at),
    [deadline, started_at, estimated_days, completed_at],
  );

  const style = statusStyles[status];

  let text: string;
  if (status === "concluido") {
    text = `Concluído em ${format(completed_at!, "dd/MM/yyyy")}`;
  } else if (status === "aguardando") {
    text = "Aguardando início";
  } else if (status === "vencido") {
    text = `${Math.abs(daysLeft)}d atrasado`;
  } else {
    text = `${daysLeft}d restantes`;
  }

  return (
    <div className="flex flex-col gap-0.5 min-w-[100px]">
      {label && <span className="text-[10px] font-medium text-muted-foreground leading-none">{label}</span>}
      <div className={cn("inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium", style.badge)}>
        {text}
      </div>
      {status !== "aguardando" && status !== "concluido" && (
        <div className="h-1 w-full rounded-full bg-secondary overflow-hidden">
          <div className={cn("h-full rounded-full transition-all", style.bar)} style={{ width: `${progress}%` }} />
        </div>
      )}
    </div>
  );
}
