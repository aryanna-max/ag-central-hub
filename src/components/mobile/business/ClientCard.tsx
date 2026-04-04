import { Badge } from "@/components/ui/badge";

interface Props {
  client: any;
  projectCount: number;
  onClick: () => void;
}

export default function ClientCard({ client, projectCount, onClick }: Props) {
  const initials = client.name
    .split(" ")
    .map((part: string) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl border border-border/50 bg-card/90 backdrop-blur p-4 shadow-sm active:scale-[0.99] transition-transform"
    >
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold text-foreground truncate">{client.name}</p>
            <Badge variant="outline">{client.tipo || "PJ"}</Badge>
          </div>
          <p className="text-sm text-muted-foreground truncate">{client.cidade || client.city || "—"}{client.estado || client.state ? `/${client.estado || client.state}` : ""}</p>
          <p className="text-xs text-muted-foreground mt-1">Projetos ativos: {projectCount}</p>
        </div>
      </div>
    </button>
  );
}
