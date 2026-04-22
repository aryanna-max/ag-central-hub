import { useMemo } from "react";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { CircleCheck, CircleAlert, CircleX, Loader2 } from "lucide-react";
import {
  useEmployeeBadge,
  formatDocType,
  type BadgeColor,
  type EmployeeBadgeData,
} from "@/hooks/useEmployeeBadge";

// =============================================================================
// EmployeeBadge — validação docs funcionário × cliente (Gap 5)
// =============================================================================
// Pequeno badge circular colorido que, ao hover, mostra detalhes de pendências.
// Integra com fn_employee_badge_for_project via useEmployeeBadge hook.
//
// Uso:
//   <EmployeeBadge employeeId={emp.id} projectId={proj.id} />
//
// Também aceita badge pré-carregado (modo "batch" do useEmployeesBadgesForProject):
//   <EmployeeBadge badge={batchMap.get(emp.id)} />
// =============================================================================

const COLOR_STYLES: Record<BadgeColor, { bg: string; icon: typeof CircleCheck; label: string }> = {
  verde: {
    bg: "bg-green-500 text-white",
    icon: CircleCheck,
    label: "Apto",
  },
  amarelo: {
    bg: "bg-amber-500 text-white",
    icon: CircleAlert,
    label: "Atenção",
  },
  vermelho: {
    bg: "bg-red-600 text-white",
    icon: CircleX,
    label: "Bloqueio",
  },
};

type Props = {
  employeeId?: string;
  projectId?: string;
  /** Se fornecido, ignora a query do hook e usa este badge direto (modo batch) */
  badge?: EmployeeBadgeData | null;
  size?: "xs" | "sm" | "md";
  /** Exibir label textual ao lado do ícone */
  showLabel?: boolean;
};

export default function EmployeeBadge({
  employeeId,
  projectId,
  badge: badgeProp,
  size = "sm",
  showLabel = false,
}: Props) {
  const { data: badgeFromQuery, isLoading } = useEmployeeBadge(
    badgeProp ? null : employeeId,
    badgeProp ? null : projectId
  );

  const badge = badgeProp ?? badgeFromQuery;

  const sizeClass = useMemo(() => {
    switch (size) {
      case "xs":
        return "h-4 w-4 p-0.5";
      case "sm":
        return "h-5 w-5 p-0.5";
      case "md":
        return "h-6 w-6 p-1";
    }
  }, [size]);

  if (isLoading && !badge) {
    return (
      <span
        className={`${sizeClass} inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground`}
        title="Validando docs..."
      >
        <Loader2 className="w-full h-full animate-spin" />
      </span>
    );
  }

  if (!badge) {
    return null;
  }

  const style = COLOR_STYLES[badge.color];
  const Icon = style.icon;

  return (
    <HoverCard openDelay={150}>
      <HoverCardTrigger asChild>
        <span
          className={`inline-flex items-center gap-1 rounded-full ${style.bg} cursor-help ${
            showLabel ? "px-2 py-0.5 text-[10px] font-semibold" : sizeClass
          }`}
          aria-label={`${style.label}: ${badge.reason}`}
        >
          <Icon className={showLabel ? "w-3 h-3" : "w-full h-full"} />
          {showLabel && <span>{style.label}</span>}
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 text-sm space-y-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${
            badge.color === "verde" ? "text-green-600"
              : badge.color === "amarelo" ? "text-amber-600"
                : "text-red-600"
          }`} />
          <strong className="text-xs uppercase tracking-wide">
            {style.label}
          </strong>
        </div>
        <p className="text-xs text-muted-foreground">{badge.reason}</p>

        {badge.missing_docs.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase text-red-700">
              Faltando ({badge.missing_docs.length})
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {badge.missing_docs.map((d) => (
                <span
                  key={d}
                  className="inline-block px-1.5 py-0.5 text-[10px] bg-red-50 text-red-700 rounded border border-red-200"
                >
                  {formatDocType(d)}
                </span>
              ))}
            </div>
          </div>
        )}

        {badge.expired_docs.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase text-red-700">
              Vencidos ({badge.expired_docs.length})
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {badge.expired_docs.map((d) => (
                <span
                  key={d}
                  className="inline-block px-1.5 py-0.5 text-[10px] bg-red-50 text-red-700 rounded border border-red-200"
                >
                  {formatDocType(d)}
                </span>
              ))}
            </div>
          </div>
        )}

        {badge.expiring_docs.length > 0 && (
          <div>
            <p className="text-[10px] font-semibold uppercase text-amber-700">
              Vencendo em breve
            </p>
            <ul className="mt-1 space-y-0.5">
              {badge.expiring_docs.map((e) => (
                <li key={e.type} className="text-[11px] flex justify-between">
                  <span>{formatDocType(e.type)}</span>
                  <span className="text-muted-foreground">
                    {e.days_left}d
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(badge.not_integrated || badge.integration_expired) && (
          <p className="text-[11px] text-red-700 bg-red-50 border border-red-200 rounded px-2 py-1">
            ⚠ {badge.integration_expired
              ? "Integração no cliente vencida"
              : "Funcionário não integrado neste cliente"}
          </p>
        )}

        {badge.required_docs.length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">
              Requisitos do cliente
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {badge.required_docs.map(formatDocType).join(" · ")}
            </p>
          </div>
        )}
      </HoverCardContent>
    </HoverCard>
  );
}
