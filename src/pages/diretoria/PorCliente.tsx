import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LayoutGrid, Table2, Search } from "lucide-react";
import { SEGMENTOS } from "@/hooks/useClients";
import { useClientCockpit, type ClientCockpitRow } from "@/hooks/useClientCockpit";
import PorClienteVisaoGeral from "./PorClienteVisaoGeral";
import PorClienteAprofundado from "./PorClienteAprofundado";
import ClientDetailSheet from "./ClientDetailSheet";
import { cn } from "@/lib/utils";

type ViewMode = "geral" | "aprofundado";

const VIEW_STORAGE_KEY = "diretoria_cliente_view";

function readViewMode(): ViewMode {
  if (typeof window === "undefined") return "geral";
  const v = window.localStorage.getItem(VIEW_STORAGE_KEY);
  return v === "aprofundado" ? "aprofundado" : "geral";
}

export default function PorCliente() {
  const { role, user } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>(readViewMode);
  const [searchTerm, setSearchTerm] = useState("");
  const [segmentoFilter, setSegmentoFilter] = useState<string>("all");
  const [focusedClientId, setFocusedClientId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetRow, setSheetRow] = useState<ClientCockpitRow | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    }
  }, [viewMode]);

  // Diretor não-master: filtra clientes onde tem ao menos 1 projeto como comercial
  const comercialFilterId = useMemo(
    () => (role === "diretor" && user?.id ? user.id : null),
    [role, user?.id],
  );

  // Pre-fetch para keep query warm (compartilhado por Visão Geral e Aprofundado)
  useClientCockpit();

  const handleOpenDetails = (row: ClientCockpitRow) => {
    setSheetRow(row);
    setSheetOpen(true);
    setFocusedClientId(row.client.id);
  };

  const handleOpenAprofundado = (row: ClientCockpitRow) => {
    setFocusedClientId(row.client.id);
    setViewMode("aprofundado");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ ou segmento"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-8 h-9 text-sm"
          />
        </div>

        <Select value={segmentoFilter} onValueChange={setSegmentoFilter}>
          <SelectTrigger className="w-[180px] h-9 text-sm">
            <SelectValue placeholder="Segmento" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos segmentos</SelectItem>
            {SEGMENTOS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center rounded-md border p-0.5 gap-0.5">
          <Button
            type="button"
            size="sm"
            variant={viewMode === "geral" ? "default" : "ghost"}
            className={cn("h-7 text-xs", viewMode !== "geral" && "text-muted-foreground")}
            onClick={() => setViewMode("geral")}
          >
            <LayoutGrid className="h-3.5 w-3.5 mr-1.5" />
            Visão geral
          </Button>
          <Button
            type="button"
            size="sm"
            variant={viewMode === "aprofundado" ? "default" : "ghost"}
            className={cn("h-7 text-xs", viewMode !== "aprofundado" && "text-muted-foreground")}
            onClick={() => setViewMode("aprofundado")}
          >
            <Table2 className="h-3.5 w-3.5 mr-1.5" />
            Aprofundado
          </Button>
        </div>
      </div>

      {viewMode === "geral" ? (
        <PorClienteVisaoGeral
          searchTerm={searchTerm}
          segmentoFilter={segmentoFilter}
          comercialFilterId={comercialFilterId}
          onOpenDetails={handleOpenDetails}
          onOpenAprofundado={handleOpenAprofundado}
        />
      ) : (
        <PorClienteAprofundado
          searchTerm={searchTerm}
          segmentoFilter={segmentoFilter}
          comercialFilterId={comercialFilterId}
          focusedClientId={focusedClientId}
          onRowClick={handleOpenDetails}
        />
      )}

      <ClientDetailSheet
        row={sheetRow}
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o);
          if (!o) setSheetRow(null);
        }}
      />
    </div>
  );
}
