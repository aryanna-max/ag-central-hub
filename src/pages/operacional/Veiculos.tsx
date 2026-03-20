import { useState, useMemo } from "react";
import { Car, Plus, Trash2, Pencil, Eye, Filter, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  // Filters
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterSearch, setFilterSearch] = useState("");

  const filtered = useMemo(() => {
    if (!vehicles) return [];
    return vehicles.filter((v: any) => {
      if (filterStatus !== "all" && v.status !== filterStatus) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        if (
          !v.plate.toLowerCase().includes(q) &&
          !v.model.toLowerCase().includes(q) &&
          !(v.brand || "").toLowerCase().includes(q) &&
          !(v.owner_name || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [vehicles, filterStatus, filterSearch]);

  const openNew = () => { setSelectedVehicle(null); setEditOpen(true); };
  const openEdit = (v: any, e: React.MouseEvent) => { e.stopPropagation(); setSelectedVehicle(v); setEditOpen(true); };
  const openDetail = (v: any) => { setSelectedVehicle(v); setDetailOpen(true); };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Car className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Veículos</h1>
            <p className="text-sm text-muted-foreground">Controle de frota e disponibilidade</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
          <Button onClick={openNew} className="gap-2">
            <Plus className="w-4 h-4" /> Novo Veículo
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar placa, modelo, marca..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-60"
            />
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="disponivel">Disponível</SelectItem>
                <SelectItem value="em_uso">Em Uso</SelectItem>
                <SelectItem value="manutencao">Manutenção</SelectItem>
                <SelectItem value="indisponivel">Indisponível</SelectItem>
              </SelectContent>
            </Select>
            {(filterStatus !== "all" || filterSearch) && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterStatus("all"); setFilterSearch(""); }}>
                Limpar
              </Button>
            )}
            <Badge variant="outline" className="ml-auto">{filtered.length} veículos</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-muted-foreground">Carregando...</p>
          ) : !filtered.length ? (
            <p className="p-6 text-center text-muted-foreground">Nenhum veículo encontrado.</p>
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
                {filtered.map((v: any) => (
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
