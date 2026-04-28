import { useMemo, useState } from "react";
import { useClientCockpit, type ClientCockpitRow } from "@/hooks/useClientCockpit";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableTableHead, type SortDir } from "@/components/ui/sortable-table-head";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface PorClienteAprofundadoProps {
  searchTerm: string;
  segmentoFilter: string;
  comercialFilterId: string | null;
  focusedClientId: string | null;
  onRowClick: (row: ClientCockpitRow) => void;
}

type SortKey =
  | "name"
  | "segmento"
  | "projetosAtivos"
  | "aReceber"
  | "alertas"
  | "ultimaAtividade"
  | "comercial";

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function exportCsv(rows: ClientCockpitRow[]) {
  const header = [
    "Cliente",
    "CNPJ",
    "Segmento",
    "Projetos ativos",
    "A receber (R$)",
    "Alertas",
    "Ultima atividade",
    "Comercial",
    "Semaforo",
    "Sinais",
  ];
  const lines = rows.map((r) =>
    [
      r.client.name,
      r.cnpjPrincipal ?? "",
      r.segmento ?? "",
      r.kpis.projetosAtivos,
      r.kpis.aReceber,
      r.kpis.alertas,
      r.kpis.ultimaAtividade ?? "",
      r.comercialResponsavel ?? "",
      r.semaforo,
      r.signals.map((s) => s.message).join(" | "),
    ]
      .map(csvEscape)
      .join(";"),
  );
  const csv = [header.map(csvEscape).join(";"), ...lines].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clientes-cockpit-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function PorClienteAprofundado({
  searchTerm,
  segmentoFilter,
  comercialFilterId,
  focusedClientId,
  onRowClick,
}: PorClienteAprofundadoProps) {
  const { data: rows = [], isLoading } = useClientCockpit();
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filteredRows = rows.filter((r) => {
      if (comercialFilterId && r.comercialResponsavelId !== comercialFilterId)
        return false;
      if (segmentoFilter !== "all" && r.segmento !== segmentoFilter) return false;
      if (term) {
        const haystack = `${r.client.name} ${r.client.cnpj ?? ""} ${r.segmento ?? ""}`.toLowerCase();
        if (!haystack.includes(term)) return false;
      }
      return true;
    });

    const dirMul = sortDir === "asc" ? 1 : -1;
    return [...filteredRows].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.client.name.localeCompare(b.client.name) * dirMul;
        case "segmento":
          return (a.segmento ?? "").localeCompare(b.segmento ?? "") * dirMul;
        case "projetosAtivos":
          return (a.kpis.projetosAtivos - b.kpis.projetosAtivos) * dirMul;
        case "aReceber":
          return (a.kpis.aReceber - b.kpis.aReceber) * dirMul;
        case "alertas":
          return (a.kpis.alertas - b.kpis.alertas) * dirMul;
        case "ultimaAtividade":
          return (
            (a.kpis.ultimaAtividade ?? "").localeCompare(
              b.kpis.ultimaAtividade ?? "",
            ) * dirMul
          );
        case "comercial":
          return (
            (a.comercialResponsavel ?? "").localeCompare(
              b.comercialResponsavel ?? "",
            ) * dirMul
          );
        default:
          return 0;
      }
    });
  }, [rows, searchTerm, segmentoFilter, comercialFilterId, sortKey, sortDir]);

  if (isLoading) return <Skeleton className="h-64 w-full" />;

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportCsv(filtered)}
          disabled={filtered.length === 0}
        >
          <Download className="h-3.5 w-3.5 mr-1.5" />
          Export CSV ({filtered.length})
        </Button>
      </div>

      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableTableHead
                sortKey="name"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={() => handleSort("name")}
              >
                Cliente
              </SortableTableHead>
              <TableHead>CNPJ</TableHead>
              <SortableTableHead
                sortKey="segmento"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={() => handleSort("segmento")}
              >
                Segmento
              </SortableTableHead>
              <SortableTableHead
                sortKey="projetosAtivos"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={() => handleSort("projetosAtivos")}
                className="text-right"
              >
                Proj. ativos
              </SortableTableHead>
              <SortableTableHead
                sortKey="aReceber"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={() => handleSort("aReceber")}
                className="text-right"
              >
                A receber
              </SortableTableHead>
              <SortableTableHead
                sortKey="alertas"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={() => handleSort("alertas")}
                className="text-right"
              >
                Alertas
              </SortableTableHead>
              <SortableTableHead
                sortKey="ultimaAtividade"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={() => handleSort("ultimaAtividade")}
              >
                Última ativ.
              </SortableTableHead>
              <SortableTableHead
                sortKey="comercial"
                currentSort={sortKey}
                currentDir={sortDir}
                onSort={() => handleSort("comercial")}
              >
                Comercial
              </SortableTableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground text-sm py-6">
                  Nenhum cliente corresponde aos filtros atuais.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((row) => (
                <TableRow
                  key={row.client.id}
                  className={cn(
                    "cursor-pointer",
                    focusedClientId === row.client.id && "bg-primary/5",
                  )}
                  onClick={() => onRowClick(row)}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "inline-block h-2 w-2 rounded-full",
                          row.semaforo === "vermelho" && "bg-red-500",
                          row.semaforo === "amarelo" && "bg-amber-500",
                          row.semaforo === "verde" && "bg-emerald-500",
                        )}
                      />
                      {row.client.name}
                    </div>
                  </TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    {row.cnpjPrincipal ?? "—"}
                  </TableCell>
                  <TableCell className="text-[11px]">{row.segmento ?? "—"}</TableCell>
                  <TableCell className="text-right">{row.kpis.projetosAtivos}</TableCell>
                  <TableCell className="text-right">
                    {row.kpis.aReceber > 0 ? fmtBRL(row.kpis.aReceber) : "—"}
                  </TableCell>
                  <TableCell className="text-right">{row.kpis.alertas}</TableCell>
                  <TableCell className="text-[11px] text-muted-foreground">
                    {row.kpis.ultimaAtividade
                      ? formatDistanceToNow(new Date(row.kpis.ultimaAtividade), {
                          addSuffix: true,
                          locale: ptBR,
                        })
                      : "—"}
                  </TableCell>
                  <TableCell className="text-[11px]">
                    {row.comercialResponsavel ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
