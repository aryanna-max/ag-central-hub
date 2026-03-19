import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, FileUp, Receipt } from "lucide-react";
import { toast } from "sonner";
import { useUpdateMedicao, type Medicao } from "@/hooks/useMedicoes";

const statusLabels: Record<string, string> = {
  aguardando_nf: "Aguardando NF",
  nf_emitida: "NF Emitida",
  pago: "Pago",
  cancelado: "Cancelado",
};

const statusColors: Record<string, string> = {
  aguardando_nf: "bg-amber-500 text-white",
  nf_emitida: "bg-blue-600 text-white",
  pago: "bg-green-600 text-white",
  cancelado: "bg-red-600 text-white",
};

interface Props {
  medicao: Medicao;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function MedicaoDetailDialog({ medicao, open, onOpenChange }: Props) {
  const updateMedicao = useUpdateMedicao();
  const [showNfForm, setShowNfForm] = useState(false);
  const [nfNumero, setNfNumero] = useState(medicao.nf_numero || "");
  const [nfData, setNfData] = useState(medicao.nf_data || "");
  const [pdfUrl, setPdfUrl] = useState(medicao.pdf_signed_url || "");

  const handleMarcarNfEmitida = async () => {
    if (!nfNumero || !nfData) {
      toast.error("Preencha o número e a data da NF");
      return;
    }
    try {
      await updateMedicao.mutateAsync({
        id: medicao.id,
        status: "nf_emitida",
        nf_numero: nfNumero,
        nf_data: nfData,
      });
      toast.success("NF marcada como emitida!");
      setShowNfForm(false);
      onOpenChange(false);
    } catch {
      toast.error("Erro ao atualizar medição");
    }
  };

  const handleMarcarPago = async () => {
    try {
      await updateMedicao.mutateAsync({ id: medicao.id, status: "pago" });
      toast.success("Medição marcada como paga!");
      onOpenChange(false);
    } catch {
      toast.error("Erro ao atualizar medição");
    }
  };

  const handleSavePdf = async () => {
    if (!pdfUrl) return;
    try {
      await updateMedicao.mutateAsync({ id: medicao.id, pdf_signed_url: pdfUrl });
      toast.success("PDF salvo!");
    } catch {
      toast.error("Erro ao salvar PDF");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Medição — {medicao.client_name}
            <Badge className={statusColors[medicao.status] || ""}>
              {statusLabels[medicao.status] || medicao.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">CNPJ Faturamento:</span>
              <p className="font-mono">{medicao.cnpj_faturamento || "—"}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Valor NF:</span>
              <p className="font-semibold">
                R$ {Number(medicao.valor_nf || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Período:</span>
              <p>
                {medicao.period_start && medicao.period_end
                  ? `${medicao.period_start} a ${medicao.period_end}`
                  : "—"}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">NF Nº:</span>
              <p>{medicao.nf_numero || "—"}</p>
            </div>
          </div>

          {medicao.notes && (
            <div>
              <span className="text-muted-foreground">Observações:</span>
              <p>{medicao.notes}</p>
            </div>
          )}
        </div>

        <Separator />

        {/* Ações */}
        <div className="space-y-3">
          {/* Marcar NF Emitida */}
          {medicao.status === "aguardando_nf" && (
            <>
              {!showNfForm ? (
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setShowNfForm(true)}
                >
                  <Receipt className="w-4 h-4" /> Marcar NF Emitida
                </Button>
              ) : (
                <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
                  <p className="text-sm font-medium">Dados da NF</p>
                  <Input
                    placeholder="Número da NF"
                    value={nfNumero}
                    onChange={(e) => setNfNumero(e.target.value)}
                  />
                  <Input
                    type="date"
                    value={nfData}
                    onChange={(e) => setNfData(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" onClick={() => setShowNfForm(false)}>
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={handleMarcarNfEmitida} disabled={!nfNumero || !nfData}>
                      Confirmar
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Marcar como Pago */}
          {medicao.status === "nf_emitida" && (
            <Button
              variant="outline"
              className="w-full gap-2 text-green-600 border-green-600 hover:bg-green-600/10"
              onClick={handleMarcarPago}
            >
              <CheckCircle2 className="w-4 h-4" /> Marcar como Pago
            </Button>
          )}

          {/* Upload PDF assinado */}
          <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
            <p className="text-sm font-medium flex items-center gap-2">
              <FileUp className="w-4 h-4" /> PDF Assinado pelo Cliente
            </p>
            <Input
              placeholder="URL do PDF assinado"
              value={pdfUrl}
              onChange={(e) => setPdfUrl(e.target.value)}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSavePdf} disabled={!pdfUrl}>
                Salvar PDF
              </Button>
              {medicao.pdf_signed_url && (
                <Button size="sm" variant="outline" asChild>
                  <a href={medicao.pdf_signed_url} target="_blank" rel="noopener noreferrer">
                    Ver PDF
                  </a>
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
