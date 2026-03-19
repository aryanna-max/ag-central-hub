import { useState } from "react";
import { FileText, Plus, Trash2, AlertTriangle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

  const aguardando = measurements?.filter((m) => m.status === "aguardando_nf") || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <FileText className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Medições</h1>
            <p className="text-sm text-muted-foreground">Controle de medições e faturamento</p>
          </div>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Medição
        </Button>
      </div>

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
          ) : !measurements?.length ? (
            <p className="p-6 text-center text-muted-foreground">Nenhuma medição cadastrada.</p>
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
                {measurements.map((m) => (
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
