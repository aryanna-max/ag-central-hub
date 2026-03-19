import { useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Eye, DollarSign, FileText, CheckCircle, XCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  useFieldPayments,
  useFieldPaymentItems,
  useCreateFieldPayment,
  useUpdateFieldPaymentStatus,
} from "@/hooks/useFieldPayments";

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  rascunho: { label: "Rascunho", variant: "secondary" },
  em_revisao: { label: "Em Revisão", variant: "outline" },
  aprovada: { label: "Aprovada", variant: "default" },
  paga: { label: "Paga", variant: "default" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

export default function DespesasCampo() {
  const { data: payments = [], isLoading } = useFieldPayments();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const { toast } = useToast();

  const createMutation = useCreateFieldPayment();
  const statusMutation = useUpdateFieldPaymentStatus();

  const totalGeral = payments.reduce((s, p) => s + (Number(p.total_value) || 0), 0);
  const pendentes = payments.filter((p) => p.status === "rascunho" || p.status === "em_revisao").length;
  const aprovadas = payments.filter((p) => p.status === "aprovada" || p.status === "paga").length;

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    createMutation.mutate(
      { week_start: fd.get("week_start") as string, week_end: fd.get("week_end") as string },
      {
        onSuccess: () => {
          toast({ title: "Folha criada com sucesso" });
          setShowCreate(false);
        },
        onError: (err) => toast({ title: "Erro ao criar", description: err.message, variant: "destructive" }),
      }
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Despesas de Campo</h1>
          <p className="text-muted-foreground text-sm">Gerencie as folhas de pagamento de campo semanais</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4 mr-2" /> Nova Folha
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Geral</CardTitle>
            <DollarSign className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {totalGeral.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes</CardTitle>
            <Clock className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{pendentes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aprovadas / Pagas</CardTitle>
            <CheckCircle className="w-4 h-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">{aprovadas}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Semana</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Valor Total</TableHead>
                <TableHead>Aprovado por</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando…</TableCell>
                </TableRow>
              ) : payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhuma folha cadastrada</TableCell>
                </TableRow>
              ) : (
                payments.map((p) => {
                  const cfg = statusConfig[p.status ?? "rascunho"] ?? statusConfig.rascunho;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium">
                        {format(parseISO(p.week_start), "dd/MM", { locale: ptBR })} –{" "}
                        {format(parseISO(p.week_end), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <Badge variant={cfg.variant}>{cfg.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {(Number(p.total_value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                      </TableCell>
                      <TableCell>{p.approved_by ?? "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedId(p.id)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Detail dialog */}
      <FieldPaymentDetail paymentId={selectedId} onClose={() => setSelectedId(null)} />

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Folha de Campo</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="week_start">Início da Semana</Label>
                <Input id="week_start" name="week_start" type="date" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="week_end">Fim da Semana</Label>
                <Input id="week_end" name="week_end" type="date" required />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Criando…" : "Criar Folha"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FieldPaymentDetail({ paymentId, onClose }: { paymentId: string | null; onClose: () => void }) {
  const { data: items = [], isLoading } = useFieldPaymentItems(paymentId);

  if (!paymentId) return null;

  return (
    <Dialog open={!!paymentId} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Itens da Folha</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Projeto</TableHead>
                <TableHead className="text-right">Diária</TableHead>
                <TableHead className="text-right">Dias</TableHead>
                <TableHead className="text-right">Transporte</TableHead>
                <TableHead className="text-right">Descontos</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Carregando…</TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-6 text-muted-foreground">Sem itens</TableCell>
                </TableRow>
              ) : (
                items.map((item: any) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.employees?.name ?? "—"}</TableCell>
                    <TableCell>{item.project_name ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {(Number(item.daily_value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell className="text-right">{item.days_worked ?? 0}</TableCell>
                    <TableCell className="text-right">
                      {(Number(item.transport_value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell className="text-right">
                      {(Number(item.discount_value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {(Number(item.total_value) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.payment_status === "pago" ? "default" : "secondary"}>
                        {item.payment_status === "pago" ? "Pago" : item.payment_status === "ajuste" ? "Ajuste" : "Pendente"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
