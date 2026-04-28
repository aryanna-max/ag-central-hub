import { useMemo } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import ClientCard from "./ClientCard";
import {
  useClientCockpit,
  type ClientCockpitRow,
} from "@/hooks/useClientCockpit";

export interface PorClienteVisaoGeralProps {
  searchTerm: string;
  segmentoFilter: string;
  comercialFilterId: string | null;
  onOpenDetails: (row: ClientCockpitRow) => void;
  onOpenAprofundado: (row: ClientCockpitRow) => void;
}

export default function PorClienteVisaoGeral({
  searchTerm,
  segmentoFilter,
  comercialFilterId,
  onOpenDetails,
  onOpenAprofundado,
}: PorClienteVisaoGeralProps) {
  const { data: rows = [], isLoading } = useClientCockpit();

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rows.filter((r) => {
      if (comercialFilterId && r.comercialResponsavelId !== comercialFilterId)
        return false;
      if (segmentoFilter !== "all" && r.segmento !== segmentoFilter) return false;
      if (term) {
        const haystack = `${r.client.name} ${r.client.cnpj ?? ""} ${r.segmento ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });
  }, [rows, searchTerm, segmentoFilter, comercialFilterId]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-48 rounded-lg" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        Nenhum cliente corresponde aos filtros atuais.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
      {filtered.map((row) => (
        <ClientCard
          key={row.client.id}
          row={row}
          onOpenDetails={() => onOpenDetails(row)}
          onOpenAprofundado={() => onOpenAprofundado(row)}
        />
      ))}
    </div>
  );
}
