import { useState, useMemo } from "react";
import { Plus, Eye, Trash2, FileText, AlertTriangle, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import {
  useMeasurements,
  useDeleteMeasurement,
  type Measurement,
} from "@/hooks/useMeasurements";
import MeasurementCreateDialog from "./MeasurementCreateDialog";
import MeasurementViewDialog from "./MeasurementViewDialog";

const statusColors: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  aguardando_aprovacao: "bg-amber-500 text-white",
  aprovada: "bg-blue-600 text-white",
  nf_emitida: "bg-indigo-600 text-white",
  paga: "bg-green-600 text-white",
  cancelada: "bg-red-600 text-white",
  aguardando_nf: "bg-amber-500 text-white",
  nf_emitida_legacy: "bg-blue-600 text-white",
  pago: "bg-green-600 text-white",
  cancelado: "bg-red-600 text-white",
};

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando Aprovação",
  aprovada: "Aprovada",
  nf_emitida: "NF Emitida",
  paga: "Paga",
  cancelada: "Cancelada",
  aguardando_nf: "Aguardando NF",
  pago: "Pago",
  cancelado: "Cancelado",
};

const typeLabels: Record<string, string> = {
  grid_diarias: "Grid Diárias",
  boletim_formal: "Boletim Formal",
  resumo_entrega: "Resumo Entrega",
};

function formatCurrency(v: number | null) {
  if (!v && v !== 0) return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function BoletinsMedicaoTab() {
  const { data: measurements, isLoading } = useMeasurements();
  const deleteMeasurement = useDeleteMeasurement();

  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterType, setFilterType] = useState("all");

  const filtered = useMemo(() => {
    if (!measurements) return [];
    return measurements.filter((m) => {
      if (filterStatus !== "all" && m.status !== filterStatus) return false;
      if (filterType !== "all" && m.measurement_type !== filterType) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (
          !m.codigo_bm.toLowerCase().includes(q) &&
          !(m.project_name || "").toLowerCase().includes(q) &&
          !(m.client_name || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [measurements, filterStatus, filterSearch, filterType]);

  const pendentes = filtered.filter((m) => m.status === "rascunho" || m.status === "aguardando_aprovacao");
  const totalValor = filtered.reduce((s, m) => s + (Number(m.valor_nf) || Number(m.valor_bruto) || 0), 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar código, projeto ou cliente..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-64"
            />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="aguardando_aprovacao">Aguardando Aprovação</SelectItem>
                <SelectItem value="aprovada">Aprovada</SelectItem>
                <SelectItem value="nf_emitida">NF Emitida</SelectItem>
                <SelectItem value="paga">Paga</SelectItem>
                <SelectItem value="cancelada">Cancelada</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="grid_diarias">Grid Diárias</SelectItem>
                <SelectItem value="boletim_formal">Boletim Formal</SelectItem>
                <SelectItem value="resumo_entrega">Resumo Entrega</SelectItem>
              </SelectContent>
            </Select>
            {(filterStatus !== "all" || filterSearch || filterType !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterStatus("all");
                  setFilterSearch("");
                  setFilterType("all");
                }}
              >
                Limpar
              </Button>
            )}
            <Badge variant="outline" className="ml-auto">
              {filtered.length} medições — Total: {formatCurrency(totalValor)}
            </Badge>
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="w-4 h-4" /> Nova Medição
            </Button>
          </div>
        </CardContent>
      </Card>

      {pendentes.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" />
              {pendentes.length} medição(ões) pendentes
            </div>
            {pendentes.slice(0, 5).map((m) => (
              <p key={m.id} className="text-sm text-muted-foreground ml-6">
                <span className="font-medium text-foreground">{m.codigo_bm}</span>
                {" — "}{m.project_name || "—"}
                {" — "}{formatCurrency(Number(m.valor_bruto) || 0)}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-muted-foreground">Carregando...</p>
          ) : !filtered.length ? (
            <div className="p-12 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-muted-foreground">Nenhuma medição encontrada.</p>
              <Button className="mt-4 gap-2" onClick={() => setShowCreate(true)}>
                <Plus className="w-4 h-4" /> Criar Primeira Medição
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Avanço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow
                    key={m.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedId(m.id)}
                  >
                    <TableCell className="font-mono font-medium text-sm">{m.codigo_bm}</TableCell>
                    <TableCell className="text-sm">{m.project_name || "—"}</TableCell>
                    <TableCell className="text-sm">{m.client_name || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {typeLabels[m.measurement_type] || m.measurement_type || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">
                      {m.period_start} a {m.period_end}
                    </TableCell>
                    <TableCell className="font-semibold text-sm">
                      {formatCurrency(Number(m.valor_nf) || Number(m.valor_bruto) || 0)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {m.avanco_acumulado_pct > 0
                        ? `${m.avanco_acumulado_pct.toFixed(1)}%`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusColors[m.status] || "bg-muted"}>
                        {statusLabels[m.status] || m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedId(m.id);
                          }}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("Excluir esta medição?")) deleteMeasurement.mutate(m.id);
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MeasurementCreateDialog open={showCreate} onOpenChange={setShowCreate} />

      {selectedId && (
        <MeasurementViewDialog
          measurementId={selectedId}
          open={!!selectedId}
          onOpenChange={(open) => { if (!open) setSelectedId(null); }}
        />
      )}
    </div>
  );
}
