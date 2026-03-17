import { useState } from "react";
import { Car, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { useVehicles, useCreateVehicle, useDeleteVehicle } from "@/hooks/useVehicles";
import { toast } from "sonner";

const statusColors: Record<string, string> = {
  disponivel: "bg-green-600 text-white",
  em_uso: "bg-blue-600 text-white",
  manutencao: "bg-amber-500 text-white",
  indisponivel: "bg-red-600 text-white",
};

const statusLabels: Record<string, string> = {
  disponivel: "Disponível",
  em_uso: "Em Uso",
  manutencao: "Manutenção",
  indisponivel: "Indisponível",
};

export default function Veiculos() {
  const { data: vehicles, isLoading } = useVehicles();
  const createVehicle = useCreateVehicle();
  const deleteVehicle = useDeleteVehicle();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ plate: "", model: "", brand: "", year: "", daily_rate: "" });

  const handleCreate = async () => {
    if (!form.plate || !form.model) return;
    try {
      await createVehicle.mutateAsync({
        plate: form.plate.toUpperCase(),
        model: form.model,
        brand: form.brand || undefined,
        year: form.year ? parseInt(form.year) : undefined,
        daily_rate: form.daily_rate ? parseFloat(form.daily_rate) : 0,
      });
      setShowNew(false);
      setForm({ plate: "", model: "", brand: "", year: "", daily_rate: "" });
      toast.success("Veículo cadastrado!");
    } catch {
      toast.error("Erro ao cadastrar veículo");
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Car className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Veículos</h1>
            <p className="text-sm text-muted-foreground">Controle de frota e disponibilidade</p>
          </div>
        </div>
        <Button onClick={() => setShowNew(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Novo Veículo
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-muted-foreground">Carregando...</p>
          ) : !vehicles?.length ? (
            <p className="p-6 text-center text-muted-foreground">Nenhum veículo cadastrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Modelo</TableHead>
                  <TableHead>Marca</TableHead>
                  <TableHead>Ano</TableHead>
                  <TableHead>Diária (R$)</TableHead>
                  <TableHead>KM Atual</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">{v.plate}</TableCell>
                    <TableCell>{v.model}</TableCell>
                    <TableCell>{v.brand || "—"}</TableCell>
                    <TableCell>{v.year || "—"}</TableCell>
                    <TableCell>{v.daily_rate ? `R$ ${Number(v.daily_rate).toFixed(2)}` : "—"}</TableCell>
                    <TableCell>{v.km_current?.toLocaleString() || "—"}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[v.status] || ""}>
                        {statusLabels[v.status] || v.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("Excluir este veículo?")) deleteVehicle.mutate(v.id);
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

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Veículo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Input placeholder="Placa *" value={form.plate} onChange={(e) => setForm({ ...form, plate: e.target.value })} />
            <Input placeholder="Modelo *" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
            <Input placeholder="Marca" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Ano" type="number" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
              <Input placeholder="Diária (R$)" type="number" step="0.01" value={form.daily_rate} onChange={(e) => setForm({ ...form, daily_rate: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!form.plate || !form.model}>Cadastrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
