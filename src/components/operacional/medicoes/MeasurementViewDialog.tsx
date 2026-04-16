import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { CheckCircle2, FileUp, Receipt, Download } from "lucide-react";
import { toast } from "sonner";
import {
  useMeasurementWithItems,
  useUpdateMeasurement,
} from "@/hooks/useMeasurements";
import { generateMeasurementPdfHtml } from "./MeasurementPDF";

const statusLabels: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando Aprovação",
  aprovada: "Aprovada",
  nf_emitida: "NF Emitida",
  paga: "Paga",
  cancelada: "Cancelada",
  aguardando_nf: "Aguardando NF",
  pago: "Pago",
};

const statusColors: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  aguardando_aprovacao: "bg-amber-500 text-white",
  aprovada: "bg-blue-600 text-white",
  nf_emitida: "bg-indigo-600 text-white",
  paga: "bg-green-600 text-white",
  cancelada: "bg-red-600 text-white",
  aguardando_nf: "bg-amber-500 text-white",
  pago: "bg-green-600 text-white",
};

function fmt(v: number | null) {
  return `R$ ${Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

interface Props {
  measurementId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MeasurementViewDialog({ measurementId, open, onOpenChange }: Props) {
  const { data, isLoading } = useMeasurementWithItems(measurementId);
  const updateMeasurement = useUpdateMeasurement();

  const [showNfForm, setShowNfForm] = useState(false);
  const [nfNumero, setNfNumero] = useState("");
  const [nfData, setNfData] = useState("");
  const [pdfUrl, setPdfUrl] = useState("");

  if (isLoading || !data) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl">
          <p className="p-6 text-muted-foreground">Carregando...</p>
        </DialogContent>
      </Dialog>
    );
  }

  const { measurement: m, items, entries } = data;

  const handleStatusUpdate = async (newStatus: string, extra?: Record<string, any>) => {
    try {
      await updateMeasurement.mutateAsync({ id: m.id, status: newStatus, ...extra });
      toast.success(`Status atualizado para ${statusLabels[newStatus] || newStatus}`);
      setShowNfForm(false);
    } catch {
      toast.error("Erro ao atualizar medição");
    }
  };

  const handleSavePdf = async () => {
    if (!pdfUrl) return;
    try {
      await updateMeasurement.mutateAsync({ id: m.id, pdf_signed_url: pdfUrl });
      toast.success("PDF salvo!");
    } catch {
      toast.error("Erro ao salvar PDF");
    }
  };

  const handleExportPdf = () => {
    const html = generateMeasurementPdfHtml(data);
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.print();
  };

  const typeLabel =
    m.measurement_type === "grid_diarias" ? "Grid Diárias" :
    m.measurement_type === "boletim_formal" ? "Boletim Formal" :
    m.measurement_type === "resumo_entrega" ? "Resumo Entrega" : m.measurement_type || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 flex-wrap">
            {m.codigo_bm}
            <Badge className={statusColors[m.status] || "bg-muted"}>
              {statusLabels[m.status] || m.status}
            </Badge>
            <Badge variant="outline">{typeLabel}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <div>
              <span className="text-muted-foreground">Projeto:</span>
              <p className="font-medium">{m.project_name || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Cliente:</span>
              <p className="font-medium">{m.client_name || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Proposta:</span>
              <p className="font-medium">{m.proposal_code || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Período:</span>
              <p>{m.period_start} a {m.period_end}</p>
            </div>
            <div>
              <span className="text-muted-foreground">NF Nº:</span>
              <p>{m.nf_numero || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Empresa:</span>
              <p>{m.empresa_faturadora === "ag_cartografia" ? "AG Cartografia" : "AG Topografia"}</p>
            </div>
          </div>

          <Separator />

          {m.measurement_type === "grid_diarias" && (
            <GridDiariasView entries={entries} measurement={m} />
          )}

          {m.measurement_type === "boletim_formal" && (
            <BoletimFormalView items={items} measurement={m} />
          )}

          {m.measurement_type === "resumo_entrega" && (
            <ResumoEntregaView items={items} measurement={m} />
          )}

          {(!m.measurement_type || m.measurement_type === "grid_diarias") && items.length === 0 && entries.length === 0 && (
            <LegacyView measurement={m} />
          )}

          <Separator />

          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-2" onClick={handleExportPdf}>
              <Download className="w-4 h-4" /> Exportar PDF
            </Button>

            {m.status === "rascunho" && (
              <Button size="sm" onClick={() => handleStatusUpdate("aguardando_aprovacao")}>
                Enviar para Aprovação
              </Button>
            )}

            {m.status === "aguardando_aprovacao" && (
              <Button size="sm" onClick={() => handleStatusUpdate("aprovada", { approved_by_client: true, approved_at: new Date().toISOString() })}>
                Marcar como Aprovada
              </Button>
            )}

            {(m.status === "aprovada" || m.status === "aguardando_nf") && (
              <>
                {!showNfForm ? (
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowNfForm(true)}>
                    <Receipt className="w-4 h-4" /> Marcar NF Emitida
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <Input placeholder="Nº NF" value={nfNumero} onChange={(e) => setNfNumero(e.target.value)} className="w-32" />
                    <Input type="date" value={nfData} onChange={(e) => setNfData(e.target.value)} className="w-36" />
                    <Button size="sm" onClick={() => handleStatusUpdate("nf_emitida", { nf_numero: nfNumero, nf_data: nfData })} disabled={!nfNumero || !nfData}>
                      Confirmar
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowNfForm(false)}>Cancelar</Button>
                  </div>
                )}
              </>
            )}

            {m.status === "nf_emitida" && (
              <Button size="sm" className="gap-2" onClick={() => handleStatusUpdate("paga")}>
                <CheckCircle2 className="w-4 h-4" /> Marcar como Paga
              </Button>
            )}
          </div>

          <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
            <p className="text-sm font-medium flex items-center gap-2">
              <FileUp className="w-4 h-4" /> PDF Assinado pelo Cliente
            </p>
            <div className="flex items-center gap-2">
              <Input
                placeholder="URL do PDF assinado"
                value={pdfUrl || m.pdf_signed_url || ""}
                onChange={(e) => setPdfUrl(e.target.value)}
                className="flex-1"
              />
              <Button size="sm" onClick={handleSavePdf} disabled={!pdfUrl}>Salvar</Button>
              {m.pdf_signed_url && (
                <Button size="sm" variant="outline" asChild>
                  <a href={m.pdf_signed_url} target="_blank" rel="noopener noreferrer">Ver</a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function GridDiariasView({ entries, measurement }: { entries: any[]; measurement: any }) {
  if (entries.length === 0) {
    return (
      <div className="text-center p-6 text-muted-foreground">
        Nenhum registro diário vinculado a esta medição.
      </div>
    );
  }

  const empMap = new Map<string, { name: string; days: Map<string, any> }>();
  for (const e of entries) {
    if (!empMap.has(e.employee_id)) {
      empMap.set(e.employee_id, { name: e.employee_name || "—", days: new Map() });
    }
    empMap.get(e.employee_id)!.days.set(e.date, e);
  }

  const dates = [...new Set(entries.map((e) => e.date))].sort();

  let totalNormal = 0;
  let totalSab = 0;
  let totalDom = 0;

  for (const e of entries) {
    if (!e.worked) continue;
    if (e.day_type === "sabado") totalSab++;
    else if (e.day_type === "domingo" || e.day_type === "feriado") totalDom++;
    else totalNormal++;
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Grid de Presenças</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-[150px]">Funcionário</TableHead>
              {dates.map((d) => (
                <TableHead key={d} className="text-center text-xs px-1">
                  {d.split("-")[2]}
                </TableHead>
              ))}
              <TableHead className="text-center font-bold">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from(empMap.entries()).map(([id, emp]) => {
              let total = 0;
              return (
                <TableRow key={id}>
                  <TableCell className="text-sm">{emp.name}</TableCell>
                  {dates.map((d) => {
                    const entry = emp.days.get(d);
                    if (entry?.worked) total++;
                    return (
                      <TableCell key={d} className="text-center px-1 text-xs">
                        {entry?.worked ? <span className="text-primary font-bold">X</span> : ""}
                      </TableCell>
                    );
                  })}
                  <TableCell className="text-center font-bold">{total}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded border p-2 text-center">
          <p className="text-muted-foreground text-xs">Normal</p>
          <p className="font-bold">{totalNormal} dias</p>
        </div>
        <div className="rounded border p-2 text-center bg-yellow-50/50 dark:bg-yellow-950/20">
          <p className="text-muted-foreground text-xs">Sábados</p>
          <p className="font-bold">{totalSab} dias</p>
        </div>
        <div className="rounded border p-2 text-center bg-red-50/50 dark:bg-red-950/20">
          <p className="text-muted-foreground text-xs">Dom/Feriado</p>
          <p className="font-bold">{totalDom} dias</p>
        </div>
      </div>
      <div className="rounded-lg bg-muted p-3 space-y-1">
        <div className="flex justify-between">
          <span>Bruto</span>
          <span className="font-medium">{fmt(measurement.valor_bruto)}</span>
        </div>
        <div className="flex justify-between">
          <span>Retenção ({measurement.retencao_pct}%)</span>
          <span className="text-destructive">- {fmt(measurement.valor_retencao)}</span>
        </div>
        <Separator />
        <div className="flex justify-between font-semibold">
          <span>Valor NF</span>
          <span>{fmt(measurement.valor_nf)}</span>
        </div>
      </div>
    </div>
  );
}

function BoletimFormalView({ items, measurement }: { items: any[]; measurement: any }) {
  if (items.length === 0) {
    return (
      <div className="text-center p-6 text-muted-foreground">
        Nenhum item vinculado a esta medição.
      </div>
    );
  }

  const totalMedido = items.reduce((s: number, i: any) => s + (i.measured_value || 0), 0);
  const totalAcumulado = items.reduce((s: number, i: any) => s + (i.accumulated_value || 0), 0);
  const totalContratado = items.reduce((s: number, i: any) => s + (i.total_contracted || 0), 0);

  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Itens do Boletim</h3>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead className="text-right">Qtd</TableHead>
              <TableHead className="text-right">V.U.</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Medido</TableHead>
              <TableHead className="text-right">Acumulado</TableHead>
              <TableHead className="text-right">Saldo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item: any) => (
              <TableRow key={item.id}>
                <TableCell className="font-mono text-sm">{item.item_number}</TableCell>
                <TableCell className="text-sm">{item.description}</TableCell>
                <TableCell className="text-right text-sm">{item.contracted_quantity}</TableCell>
                <TableCell className="text-right text-sm">{fmt(item.unit_value)}</TableCell>
                <TableCell className="text-right text-sm">{fmt(item.total_contracted)}</TableCell>
                <TableCell className="text-right text-sm font-medium">{fmt(item.measured_value)}</TableCell>
                <TableCell className="text-right text-sm">{fmt(item.accumulated_value)}</TableCell>
                <TableCell className="text-right text-sm">{fmt(item.remaining_value)}</TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 font-bold">
              <TableCell colSpan={4}>TOTAIS</TableCell>
              <TableCell className="text-right">{fmt(totalContratado)}</TableCell>
              <TableCell className="text-right">{fmt(totalMedido)}</TableCell>
              <TableCell className="text-right">{fmt(totalAcumulado)}</TableCell>
              <TableCell className="text-right">{fmt(totalContratado - totalAcumulado)}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded border p-2 text-center">
          <p className="text-xs text-muted-foreground">Avanço Período</p>
          <p className="font-bold">{measurement.avanco_periodo_pct?.toFixed(1) || 0}%</p>
        </div>
        <div className="rounded border p-2 text-center">
          <p className="text-xs text-muted-foreground">Avanço Acumulado</p>
          <p className="font-bold">{measurement.avanco_acumulado_pct?.toFixed(1) || 0}%</p>
        </div>
        <div className="rounded border p-2 text-center">
          <p className="text-xs text-muted-foreground">Retenção</p>
          <p className="font-bold">{measurement.retencao_pct}%</p>
        </div>
        <div className="rounded border p-2 text-center">
          <p className="text-xs text-muted-foreground">Saldo a Medir</p>
          <p className="font-bold">{fmt(measurement.saldo_a_medir)}</p>
        </div>
      </div>

      <div className="rounded-lg bg-muted p-3 space-y-1">
        <div className="flex justify-between">
          <span>Medido no período</span>
          <span className="font-medium">{fmt(totalMedido)}</span>
        </div>
        {measurement.retencao_pct > 0 && (
          <div className="flex justify-between">
            <span>Retenção ({measurement.retencao_pct}%)</span>
            <span className="text-destructive">- {fmt(totalMedido * measurement.retencao_pct / 100)}</span>
          </div>
        )}
        <Separator />
        <div className="flex justify-between font-semibold">
          <span>Valor NF</span>
          <span>{fmt(measurement.valor_nf || (totalMedido * (1 - measurement.retencao_pct / 100)))}</span>
        </div>
      </div>
    </div>
  );
}

function ResumoEntregaView({ items, measurement }: { items: any[]; measurement: any }) {
  return (
    <div className="space-y-3">
      <h3 className="font-semibold">Resumo de Entrega</h3>
      {items.length === 0 ? (
        <p className="text-muted-foreground">Nenhum item vinculado.</p>
      ) : (
        <div className="space-y-2">
          {items.map((item: any) => (
            <div key={item.id} className="rounded border p-3">
              <p className="font-medium">{item.description}</p>
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span>Valor: {fmt(item.measured_value || item.total_contracted)}</span>
                {item.unit && <span>Unidade: {item.unit}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg bg-muted p-3 space-y-1">
        <div className="flex justify-between">
          <span>Proposta</span>
          <span className="font-medium">{measurement.proposal_code || "—"}</span>
        </div>
        <div className="flex justify-between font-semibold">
          <span>Valor de entrega</span>
          <span>{fmt(measurement.valor_bruto || measurement.valor_nf)}</span>
        </div>
      </div>
    </div>
  );
}

function LegacyView({ measurement }: { measurement: any }) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-1">
      <div className="flex justify-between">
        <span className="text-muted-foreground">
          Dias 2ª-6ª: {measurement.dias_semana} × {fmt(measurement.valor_diaria_semana)}
        </span>
        <span>{fmt(measurement.dias_semana * measurement.valor_diaria_semana)}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-muted-foreground">
          Sáb/Dom/Fer: {measurement.dias_fds} × {fmt(measurement.valor_diaria_fds)}
        </span>
        <span>{fmt(measurement.dias_fds * measurement.valor_diaria_fds)}</span>
      </div>
      <Separator />
      <div className="flex justify-between">
        <span>Bruto</span>
        <span className="font-medium">{fmt(measurement.valor_bruto)}</span>
      </div>
      <div className="flex justify-between">
        <span>Retenção ({measurement.retencao_pct}%)</span>
        <span className="text-destructive">- {fmt(measurement.valor_retencao)}</span>
      </div>
      <Separator />
      <div className="flex justify-between font-semibold">
        <span>Valor NF</span>
        <span>{fmt(measurement.valor_nf)}</span>
      </div>
    </div>
  );
}
