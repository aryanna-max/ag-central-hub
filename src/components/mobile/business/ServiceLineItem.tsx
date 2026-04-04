import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SERVICE_TYPES } from "@/lib/serviceTypes";

interface ServiceItem {
  serviceType: string;
  quantity: string;
  unitValue: string;
}

interface Props {
  item: ServiceItem;
  onChange: (item: ServiceItem) => void;
  onRemove: () => void;
  canRemove: boolean;
}

export default function ServiceLineItem({ item, onChange, onRemove, canRemove }: Props) {
  const subtotal = (Number(item.quantity) || 0) * (Number(item.unitValue) || 0);

  return (
    <div className="rounded-xl border border-border/60 p-3 space-y-3 bg-card">
      <Select value={item.serviceType} onValueChange={(value) => onChange({ ...item, serviceType: value })}>
        <SelectTrigger>
          <SelectValue placeholder="Tipo de serviço" />
        </SelectTrigger>
        <SelectContent>
          {SERVICE_TYPES.map((service) => (
            <SelectItem key={service} value={service}>{service}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="grid grid-cols-2 gap-2">
        <Input
          type="number"
          placeholder="Qtd/área"
          value={item.quantity}
          onChange={(e) => onChange({ ...item, quantity: e.target.value })}
        />
        <Input
          type="number"
          placeholder="Valor unit."
          value={item.unitValue}
          onChange={(e) => onChange({ ...item, unitValue: e.target.value })}
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className="text-sm text-muted-foreground">Subtotal</span>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {subtotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </span>
          {canRemove ? (
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={onRemove}>
              <Trash2 className="w-4 h-4" />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
