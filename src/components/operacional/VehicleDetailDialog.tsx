import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Car, MapPin, User } from "lucide-react";

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

interface VehicleDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle: any;
}

export default function VehicleDetailDialog({ open, onOpenChange, vehicle }: VehicleDetailDialogProps) {
  if (!vehicle) return null;

  const responsible = vehicle.responsible_employee;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Car className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span className="text-lg">{vehicle.plate}</span>
              <span className="text-muted-foreground font-normal ml-2">
                {vehicle.brand} {vehicle.model} {vehicle.year && `(${vehicle.year})`}
              </span>
            </div>
            <Badge className={statusColors[vehicle.status] || ""}>
              {statusLabels[vehicle.status] || vehicle.status}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Summary info */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
          {vehicle.color && (
            <div className="bg-muted/50 rounded-lg p-2.5">
              <span className="text-muted-foreground block text-xs">Cor</span>
              <span className="font-medium">{vehicle.color}</span>
            </div>
          )}
          {vehicle.owner_name && (
            <div className="bg-muted/50 rounded-lg p-2.5">
              <span className="text-muted-foreground block text-xs">Proprietário</span>
              <span className="font-medium">{vehicle.owner_name}</span>
            </div>
          )}
          {responsible && (
            <div className="bg-muted/50 rounded-lg p-2.5 flex items-start gap-1.5">
              <User className="w-3.5 h-3.5 mt-0.5 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground block text-xs">Responsável</span>
                <span className="font-medium">{responsible.name}</span>
              </div>
            </div>
          )}
          {vehicle.km_current != null && (
            <div className="bg-muted/50 rounded-lg p-2.5">
              <span className="text-muted-foreground block text-xs">Hodômetro</span>
              <span className="font-medium">{Number(vehicle.km_current).toLocaleString()} km</span>
            </div>
          )}
          {vehicle.home_address && (
            <div className="bg-muted/50 rounded-lg p-2.5 col-span-2 flex items-start gap-1.5">
              <MapPin className="w-3.5 h-3.5 mt-0.5 text-muted-foreground" />
              <div>
                <span className="text-muted-foreground block text-xs">Endereço Base</span>
                <span className="font-medium">{vehicle.home_address}</span>
              </div>
            </div>
          )}
          {vehicle.daily_rate > 0 && (
            <div className="bg-muted/50 rounded-lg p-2.5">
              <span className="text-muted-foreground block text-xs">Diária</span>
              <span className="font-medium">R$ {Number(vehicle.daily_rate).toFixed(2)}</span>
            </div>
          )}
        </div>

        <Tabs defaultValue="historico" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="historico" className="flex-1">Histórico</TabsTrigger>
            <TabsTrigger value="diarias" className="flex-1">Diárias</TabsTrigger>
            <TabsTrigger value="percurso" className="flex-1">Relatório de Percurso</TabsTrigger>
          </TabsList>

          <TabsContent value="historico" className="min-h-[200px]">
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Histórico de uso e manutenções será exibido aqui.
            </div>
          </TabsContent>

          <TabsContent value="diarias" className="min-h-[200px]">
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Registro de diárias calculadas pelo fechamento de escalas.
            </div>
          </TabsContent>

          <TabsContent value="percurso" className="min-h-[200px]">
            <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
              Relatório de percurso e quilometragem será exibido aqui.
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
