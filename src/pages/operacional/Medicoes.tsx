import { useState } from "react";
import { FileText, Plus, Trash2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableHeader, TableBody, TableHead, TableRow, TableCell,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useMedicoes, useCreateMedicao, useUpdateMedicao, useDeleteMedicao, type Medicao } from "@/hooks/useMedicoes";
import MedicaoDetailDialog from "@/components/operacional/MedicaoDetailDialog";

const statusColors: Record<string, string> = {
  aguardando_nf: "bg-amber-500 text-white",
  nf_emitida: "bg-blue-600 text-white",
  pago: "bg-green-600 text-white",
  cancelado: "bg-red-600 text-white",
};

const statusLabels: Record<string, string> = {
  aguardando_nf: "Aguardando NF",
  nf_emitida: "NF Emitida",
  pago: "Pago",
  cancelado: "Cancelado",
};

export default function Medicoes() {
  const { data: medicoes, isLoading } = useMedicoes();
  const createMedicao = useCreateMedicao();
  const deleteMedicao = useDeleteMedicao();
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Medicao | null>(null);
  const [form, setForm] = useState({
    client_name: "", cnpj_faturamento: "", valor_nf: "",
    period_start: "", period_end: "", notes: "",
  });

  const handleCreate = async () => {
    if (!form.client_name) return;
    try {
      await createMedicao.mutateAsync({
        client_name: form.client_name,
        cnpj_faturamento: form.cnpj_faturamento || undefined,
        valor_nf: form.valor_nf ? parseFloat(form.valor_nf) : 0,
        period_start: form.period_start || undefined,
        period_end: form.period_end || undefined,
        notes: form.notes || undefined,
      });
      setShowNew(false);
      setForm({ client_name: "", cnpj_faturamento: "", valor_nf: "", period_start: "", period_end: "", notes: "" });
      toast.success("Medição criada!");
    } catch {
      toast.error("Erro ao criar medição");
    }
  };

  const aguardando = medicoes?.filter((m) => m.status === "aguardando_nf") || [];

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

      {/* Alertas de medições aguardando NF */}
      {aguardando.length > 0 && (
        <Card className="border-amber-500/50 bg-amber-500/5">
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 text-amber-600 font-semibold text-sm">
              <AlertTriangle className="w-4 h-4" />
              {aguardando.length} medição(ões) aguardando NF
            </div>
            {aguardando.map((m) => (
              <p key={m.id} className="text-sm text-muted-foreground ml-6">
                <span className="font-medium text-foreground">{m.client_name}</span>
                {" — "}R$ {Number(m.valor_nf || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                {m.period_start && m.period_end && (
                  <> — Período {m.period_start} a {m.period_end}</>
                )}
                {m.cnpj_faturamento && (
                  <>. Emitir NF pelo CNPJ {m.cnpj_faturamento}.</>
                )}
              </p>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-muted-foreground">Carregando...</p>
          ) : !medicoes?.length ? (
            <p className="p-6 text-center text-muted-foreground">Nenhuma medição cadastrada.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead>CNPJ Faturamento</TableHead>
                  <TableHead>Valor NF</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>NF Nº</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {medicoes.map((m) => (
                  <TableRow
                    key={m.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelected(m)}
                  >
                    <TableCell className="font-medium">{m.client_name || "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{m.cnpj_faturamento || "—"}</TableCell>
                    <TableCell>
                      {m.valor_nf ? `R$ ${Number(m.valor_nf).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}
                    </TableCell>
                    <TableCell>
                      {m.period_start && m.period_end
                        ? `${m.period_start} a ${m.period_end}`
                        : "—"}
                    </TableCell>
                    <TableCell>{m.nf_numero || "—"}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[m.status] || ""}>
                        {statusLabels[m.status] || m.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Excluir esta medição?")) deleteMedicao.mutate(m.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Dialog nova medição */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Medição</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Cliente *" value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} />
            <Input placeholder="CNPJ Faturamento" value={form.cnpj_faturamento} onChange={(e) => setForm({ ...form, cnpj_faturamento: e.target.value })} />
            <Input placeholder="Valor NF (R$)" type="number" step="0.01" value={form.valor_nf} onChange={(e) => setForm({ ...form, valor_nf: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Início do Período</label>
                <Input type="date" value={form.period_start} onChange={(e) => setForm({ ...form, period_start: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Fim do Período</label>
                <Input type="date" value={form.period_end} onChange={(e) => setForm({ ...form, period_end: e.target.value })} />
              </div>
            </div>
            <Textarea placeholder="Observações" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!form.client_name}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog detalhe */}
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
