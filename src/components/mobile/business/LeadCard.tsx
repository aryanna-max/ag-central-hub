import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  lead: any;
  displayName: string;
  onClick: () => void;
}

const STATUS_STYLES: Record<string, { label: string; bg: string; fg: string }> = {
  novo: { label: "Novo", bg: "rgba(45, 106, 142, 0.12)", fg: "#2D6A8E" },
  em_contato: { label: "Em contato", bg: "rgba(47, 158, 142, 0.12)", fg: "#2F9E8E" },
  qualificado: { label: "Qualificado", bg: "rgba(47, 158, 142, 0.12)", fg: "#2F9E8E" },
  proposta_enviada: { label: "Proposta enviada", bg: "rgba(233, 168, 37, 0.14)", fg: "#B7791F" },
  aprovado: { label: "Aprovado", bg: "rgba(138, 180, 29, 0.16)", fg: "#6B8E12" },
  convertido: { label: "Convertido", bg: "rgba(39, 174, 96, 0.16)", fg: "#1F8A4D" },
  perdido: { label: "Perdido", bg: "rgba(231, 76, 60, 0.14)", fg: "#C0392B" },
};

export default function LeadCard({ lead, displayName, onClick }: Props) {
  const status = STATUS_STYLES[lead.status] || STATUS_STYLES.novo;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border/50 bg-card/90 backdrop-blur p-4 shadow-sm active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start justify-between gap-3">
        <Badge style={{ background: status.bg, color: status.fg }}>{status.label}</Badge>
        <span className="text-sm font-semibold text-foreground">
          {lead.valor ? lead.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}
        </span>
      </div>
      <p className="text-base font-semibold text-foreground mt-3 leading-tight">{displayName}</p>
      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate">Origem: {lead.origin || "—"}</span>
        <span className="shrink-0">
          {formatDistanceToNow(new Date(lead.created_at), { addSuffix: true, locale: ptBR })}
        </span>
      </div>
    </button>
  );
}
