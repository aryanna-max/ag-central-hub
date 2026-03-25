import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { useUpdateVehicle, useCreateVehicle } from "@/hooks/useVehicles";
import { useEmployees } from "@/hooks/useEmployees";
import { toast } from "sonner";

const statusOptions = [
  { value: "disponivel", label: "Disponível" },
  { value: "em_uso", label: "Em Uso" },
  { value: "manutencao", label: "Manutenção" },
  { value: "indisponivel", label: "Indisponível" },
];

interface VehicleEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  vehicle?: any;
}

export default function VehicleEditDialog({ open, onOpenChange, vehicle }: VehicleEditDialogProps) {
  const isNew = !vehicle;
  const updateVehicle = useUpdateVehicle();
  const createVehicle = useCreateVehicle();
  const { data: employees } = useEmployees();

  const [form, setForm] = useState({
    plate: "",
    model: "",
    brand: "",
    year: "",
    color: "",
    status: "disponivel",
    owner_name: "",
    responsible_employee_id: "",
    home_address: "",
    km_current: "",
    daily_rate: "",
    is_rented: false,
  });

  useEffect(() => {
    if (vehicle) {
      setForm({
        plate: vehicle.plate || "",
        model: vehicle.model || "",
        brand: vehicle.brand || "",
        year: vehicle.year?.toString() || "",
        color: vehicle.color || "",
        status: vehicle.status || "disponivel",
        owner_name: vehicle.owner_name || "",
        responsible_employee_id: vehicle.responsible_employee_id || "",
        home_address: vehicle.home_address || "",
        km_current: vehicle.km_current?.toString() || "",
        daily_rate: vehicle.daily_rate?.toString() || "",
        is_rented: vehicle.is_rented || false,
      });
    } else {
      setForm({
        plate: "", model: "", brand: "", year: "", color: "",
        status: "disponivel", owner_name: "", responsible_employee_id: "",
        home_address: "", km_current: "", daily_rate: "", is_rented: false,
      });
    }
  }, [vehicle, open]);

  const handleSave = async () => {
    if (!form.plate || !form.model) return;
    const payload: any = {
      plate: form.plate.toUpperCase(),
      model: form.model,
      brand: form.brand || null,
      year: form.year ? parseInt(form.year) : null,
      color: form.color || null,
      status: form.status,
      owner_name: form.owner_name || null,
      responsible_employee_id: form.is_rented ? null : (form.responsible_employee_id || null),
      home_address: form.home_address || null,
      km_current: form.km_current ? parseInt(form.km_current) : null,
      daily_rate: form.daily_rate ? parseFloat(form.daily_rate) : 0,
      is_rented: form.is_rented,
    };

    try {
      if (isNew) {
        await createVehicle.mutateAsync(payload);
        toast.success("Veículo cadastrado!");
      } else {
        await updateVehicle.mutateAsync({ id: vehicle.id, ...payload });
        toast.success("Veículo atualizado!");
      }
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar veículo");
    }
  };

  const set = (field: string, value: string | boolean) => setForm(f => ({ ...f, [field]: value }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Novo Veículo" : "Editar Veículo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Placa *</Label>
              <Input value={form.plate} onChange={e => set("plate", e.target.value)} placeholder="ABC-1D23" />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo *</Label>
              <Input value={form.model} onChange={e => set("model", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Marca</Label>
              <Input value={form.brand} onChange={e => set("brand", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Ano</Label>
              <Input type="number" value={form.year} onChange={e => set("year", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Cor</Label>
              <Input value={form.color} onChange={e => set("color", e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={v => set("status", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Alugado checkbox */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="is_rented"
              checked={form.is_rented}
              onCheckedChange={(checked) => set("is_rented", !!checked)}
            />
            <Label htmlFor="is_rented" className="cursor-pointer">Veículo alugado (locadora)</Label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Proprietário</Label>
              <Input value={form.owner_name} onChange={e => set("owner_name", e.target.value)} placeholder="Nome do proprietário" />
            </div>
            {/* Responsável - oculto quando alugado */}
            {!form.is_rented && (
              <div className="space-y-1.5">
                <Label>Motorista Responsável</Label>
                <Select value={form.responsible_employee_id || "none"} onValueChange={v => set("responsible_employee_id", v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {employees?.filter(e => e.status === "disponivel").map(e => (
                      <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Endereço Base</Label>
            <Input value={form.home_address} onChange={e => set("home_address", e.target.value)} placeholder="Local onde o veículo fica estacionado" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Hodômetro (KM)</Label>
              <Input type="number" value={form.km_current} onChange={e => set("km_current", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Label className="flex items-center gap-1 cursor-help">
                      Diária (R$) <Info className="w-3.5 h-3.5 text-muted-foreground" />
                    </Label>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-48">Preenchido automaticamente pelo fechamento da escala diária</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Input
                type="number"
                step="0.01"
                value={form.daily_rate}
                readOnly={!isNew}
                className={!isNew ? "bg-muted cursor-not-allowed" : ""}
                onChange={e => isNew && set("daily_rate", e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!form.plate || !form.model}>
            {isNew ? "Cadastrar" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
