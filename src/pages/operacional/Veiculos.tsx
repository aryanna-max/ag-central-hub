import { useState } from "react";
import { Car, Plus, Trash2, Pencil, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { useVehicles, useDeleteVehicle } from "@/hooks/useVehicles";
import VehicleEditDialog from "@/components/operacional/VehicleEditDialog";
import VehicleDetailDialog from "@/components/operacional/VehicleDetailDialog";
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
  const deleteVehicle = useDeleteVehicle();
  const [editOpen, setEditOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedVehicle, setSelectedVehicle] = useState<any>(null);

  const openNew = () => { setSelectedVehicle(null); setEditOpen(true); };
  const openEdit = (v: any, e: React.MouseEvent) => { e.stopPropagation(); setSelectedVehicle(v); setEditOpen(true); };
  const openDetail = (v: any) => { setSelectedVehicle(v); setDetailOpen(true); };

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
        <Button onClick={openNew} className="gap-2">
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
                  <TableHead>KM Atual</TableHead>
                  <TableHead>Responsável</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vehicles.map((v: any) => (
                  <TableRow
                    key={v.id}
                    className="cursor-pointer"
                    onClick={() => openDetail(v)}
                  >
                    <TableCell className="font-medium">{v.plate}</TableCell>
                    <TableCell>{v.model}</TableCell>
                    <TableCell>{v.brand || "—"}</TableCell>
                    <TableCell>{v.year || "—"}</TableCell>
                    <TableCell>{v.km_current ? Number(v.km_current).toLocaleString() : "—"}</TableCell>
                    <TableCell>{v.responsible_employee?.name || "—"}</TableCell>
                    <TableCell>
                      <Badge className={statusColors[v.status] || ""}>
                        {statusLabels[v.status] || v.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={e => openEdit(v, e)} title="Editar">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={e => { e.stopPropagation(); openDetail(v); }} title="Detalhes">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={e => {
                            e.stopPropagation();
                            if (confirm("Excluir este veículo?")) deleteVehicle.mutate(v.id);
                          }}
                          title="Excluir"
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

      <VehicleEditDialog open={editOpen} onOpenChange={setEditOpen} vehicle={selectedVehicle} />
      <VehicleDetailDialog open={detailOpen} onOpenChange={setDetailOpen} vehicle={selectedVehicle} />
    </div>
  );
}
