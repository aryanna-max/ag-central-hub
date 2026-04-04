import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface Props {
  proposal: any;
  clientName: string;
  onClick: () => void;
}

const STATUS_STYLES: Record<string, { label: string; bg: string; fg: string }> = {
  rascunho: { label: "Rascunho", bg: "rgba(99, 101, 105, 0.14)", fg: "#636569" },
  enviada: { label: "Enviada", bg: "rgba(45, 106, 142, 0.12)", fg: "#2D6A8E" },
  aprovada: { label: "Aprovada", bg: "rgba(138, 180, 29, 0.16)", fg: "#6B8E12" },
  rejeitada: { label: "Rejeitada", bg: "rgba(231, 76, 60, 0.14)", fg: "#C0392B" },
  expirada: { label: "Expirada", bg: "rgba(233, 168, 37, 0.14)", fg: "#B7791F" },
};

export default function ProposalCard({ proposal, clientName, onClick }: Props) {
  const status = STATUS_STYLES[proposal.status] || STATUS_STYLES.rascunho;

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border/50 bg-card/90 backdrop-blur p-4 shadow-sm active:scale-[0.99] transition-transform"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-mono text-primary font-semibold">{proposal.code || "Sem código"}</p>
          <p className="text-base font-semibold text-foreground mt-1">{clientName}</p>
        </div>
        <Badge style={{ background: status.bg, color: status.fg }}>{status.label}</Badge>
      </div>
      <div className="mt-3 space-y-1 text-sm">
        <p className="text-foreground line-clamp-1">{proposal.title || proposal.service || "Proposta"}</p>
        <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          <span>{proposal.created_at ? format(new Date(proposal.created_at), "dd/MM/yyyy") : "—"}</span>
          <span className="font-semibold text-foreground">
            {Number(proposal.final_value || proposal.estimated_value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
        </div>
      </div>
    </button>
  );
}
