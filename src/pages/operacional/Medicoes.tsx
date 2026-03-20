import { useState, useMemo } from "react";
import { FileText, Plus, Trash2, AlertTriangle, Eye, Printer, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { toast } from "sonner";
import { useMeasurements, useDeleteMeasurement, type Measurement } from "@/hooks/useMeasurements";
import MeasurementFormDialog from "@/components/operacional/MeasurementFormDialog";
import MedicaoDetailDialog from "@/components/operacional/MedicaoDetailDialog";

const statusColors: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  aguardando_nf: "bg-amber-500 text-white",
  nf_emitida: "bg-blue-600 text-white",
  pago: "bg-green-600 text-white",
  cancelado: "bg-red-600 text-white",
};

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_nf: "Aguardando NF",
  nf_emitida: "NF Emitida",
  pago: "Pago",
  cancelado: "Cancelado",
};

function formatCurrency(v: number | null) {
  if (!v && v !== 0) return "—";
  return `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

export default function Medicoes() {
  const { data: measurements, isLoading } = useMeasurements();
  const deleteMeasurement = useDeleteMeasurement();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Measurement | null>(null);

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  const filtered = useMemo(() => {
    if (!measurements) return [];
    return measurements.filter((m) => {
      if (filterStatus !== "all" && m.status !== filterStatus) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (
          !m.codigo_bm.toLowerCase().includes(q) &&
          !(m.obra_name || "").toLowerCase().includes(q) &&
          !(m.team_name || "").toLowerCase().includes(q)
        )
          return false;
      }
      if (filterStart && m.period_start < filterStart) return false;
      if (filterEnd && m.period_end > filterEnd) return false;
      return true;
    });
  }, [measurements, filterStatus, filterSearch, filterStart, filterEnd]);

  const aguardando = filtered.filter((m) => m.status === "aguardando_nf");
  const totalNF = filtered.reduce((s, m) => s + (Number(m.valor_nf) || 0), 0);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Medições</h1>
            <p className="text-sm text-muted-foreground">Controle de medições e faturamento</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handlePrint} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
          <Button onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Medição
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar código, obra ou equipe..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-56"
            />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="rascunho">Rascunho</SelectItem>
                <SelectItem value="aguardando_nf">Aguardando NF</SelectItem>
                <SelectItem value="nf_emitida">NF Emitida</SelectItem>
                <SelectItem value="pago">Pago</SelectItem>
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
            <Input type="date" placeholder="De" value={filterStart} onChange={(e) => setFilterStart(e.target.value)} className="w-40" />
            <Input type="date" placeholder="Até" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)} className="w-40" />
            {(filterStatus !== "all" || filterSearch || filterStart || filterEnd) && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterStatus("all"); setFilterSearch(""); setFilterStart(""); setFilterEnd(""); }}>
                Limpar
              </Button>
            )}
            <Badge variant="outline" className="ml-auto">{filtered.length} medições • Total NF: {formatCurrency(totalNF)}</Badge>
          </div>
        </CardContent>
      </Card>

      {aguardando.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-50/50 dark:bg-amber-950/20">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" />
              {aguardando.length} medição(ões) aguardando NF
            </div>
            {aguardando.map((m) => (
              <p key={m.id} className="text-sm text-muted-foreground ml-6">
                <span className="font-medium text-foreground">{m.codigo_bm}</span>
                {" — "}{formatCurrency(m.valor_nf)}
                {" — Período "}{m.period_start} a {m.period_end}
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
            <p className="p-6 text-center text-muted-foreground">Nenhuma medição encontrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código BM</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Valor NF</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => (
                  <TableRow key={m.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelected(m)}>
                    <TableCell className="font-mono font-medium">{m.codigo_bm}</TableCell>
                    <TableCell>{m.obra_name || "—"}</TableCell>
                    <TableCell className="text-sm">
                      {m.period_start} a {m.period_end}
                    </TableCell>
                    <TableCell>{m.team_name || "—"}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(m.valor_nf)}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[m.status] || ""}>
                        {statusLabels[m.status] || m.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setSelected(m); }}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost" size="icon" className="text-destructive"
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

      <MeasurementFormDialog open={showNew} onOpenChange={setShowNew} />

      {selected && (
        <MedicaoDetailDialog
          medicao={selected}
          open={!!selected}
          onOpenChange={(open) => { if (!open) setSelected(null); }}
        />
      )}
    </div>
  );
}
