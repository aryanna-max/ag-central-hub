import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useEmployees } from "@/hooks/useEmployees";
import { useActiveProjects } from "@/hooks/useProjects";
import { useCreateAlerts, type AlertInsert } from "@/hooks/useAlerts";
import {
  useCreateFieldPayment,
  useBulkCreateFieldPaymentItems,
  EXPENSE_TYPES,
  NATURE_OPTIONS,
} from "@/hooks/useFieldPayments";

interface ItemDraft {
  key: number;
  employee_id: string;
  project_id: string;
  expense_type: string;
  nature: string;
  description: string;
  total_value: number;
  actual_receiver_id: string;
  intermediary_reason: string;
}

const emptyItem = (key: number): ItemDraft => ({
  key,
  employee_id: "",
  project_id: "",
  expense_type: "",
  nature: "reembolso",
  description: "",
  total_value: 0,
  actual_receiver_id: "",
  intermediary_reason: "",
});

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function DespesaCampoDrawer({ open, onOpenChange }: Props) {
  const [weekStart, setWeekStart] = useState("");
  const [weekEnd, setWeekEnd] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([emptyItem(1)]);
  const [nextKey, setNextKey] = useState(2);

  const { data: employees = [] } = useEmployees();
  const { data: projects = [] } = useActiveProjects();
  const { toast } = useToast();

  const createPayment = useCreateFieldPayment();
  const bulkItems = useBulkCreateFieldPaymentItems();
  const createAlerts = useCreateAlerts();

  const activeEmployees = employees.filter((e) => e.status !== "desligado");

  const total = items.reduce((s, i) => s + (Number(i.total_value) || 0), 0);

  const addItem = () => {
    setItems([...items, emptyItem(nextKey)]);
    setNextKey(nextKey + 1);
  };

  const removeItem = (key: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((i) => i.key !== key));
  };

  const updateItem = (key: number, field: keyof ItemDraft, value: any) => {
    setItems(items.map((i) => (i.key === key ? { ...i, [field]: value } : i)));
  };

  const validate = () => {
    if (!weekStart || !weekEnd) return "Informe o período da semana.";
    for (const item of items) {
      if (!item.employee_id) return "Selecione o funcionário em todos os itens.";
      if (!item.expense_type) return "Selecione o tipo em todos os itens.";
      if (!item.description.trim()) return "Preencha a descrição em todos os itens.";
      if (!item.total_value || item.total_value <= 0) return "Informe o valor em todos os itens.";
    }
    return null;
  };

  const handleSave = async (submit: boolean) => {
    const err = validate();
    if (err) return toast({ title: err, variant: "destructive" });

    try {
      const status = submit ? ("submetido" as any) : ("rascunho" as any);
      const payment = await createPayment.mutateAsync({
        week_start: weekStart,
        week_end: weekEnd,
        status,
        total_value: total,
      });

      await bulkItems.mutateAsync(
        items.map((i) => ({
          field_payment_id: payment.id,
          employee_id: i.employee_id,
          project_id: i.project_id || null,
          project_name: projects.find((p) => p.id === i.project_id)?.name || null,
          expense_type: i.expense_type,
          nature: i.nature,
          description: i.description,
          total_value: i.total_value,
          actual_receiver_id: i.actual_receiver_id || null,
          actual_receiver_name: i.actual_receiver_id
            ? activeEmployees.find((e) => e.id === i.actual_receiver_id)?.name || null
            : null,
          intermediary_reason: i.actual_receiver_id && i.actual_receiver_id !== i.employee_id
            ? i.intermediary_reason
            : null,
          payment_status: "pendente",
        }))
      );

      if (submit) {
        await createAlerts.mutateAsync([
          {
            alert_type: "despesa_campo",
            recipient: "diretoria",
            priority: "importante",
            title: "Nova folha de despesas submetida",
            message: `Período ${format(new Date(weekStart + "T12:00:00"), "dd/MM", { locale: ptBR })} – ${format(new Date(weekEnd + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })} • Total: ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
            reference_type: "field_payment",
            reference_id: payment.id,
          } as AlertInsert,
        ]);
      }

      toast({ title: submit ? "Folha submetida para aprovação" : "Rascunho salvo" });
      resetForm();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const resetForm = () => {
    setWeekStart("");
    setWeekEnd("");
    setItems([emptyItem(1)]);
    setNextKey(2);
  };

  const isPending = createPayment.isPending || bulkItems.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nova Folha de Despesas de Campo</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Period */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Início da Semana</Label>
              <Input type="date" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim da Semana</Label>
              <Input type="date" value={weekEnd} onChange={(e) => setWeekEnd(e.target.value)} />
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Itens</h3>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar Item
              </Button>
            </div>

            {items.map((item, idx) => (
              <div key={item.key} className="border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
                  {items.length > 1 && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(item.key)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Funcionário */}
                  <div className="space-y-1">
                    <Label className="text-xs">Funcionário *</Label>
                    <Select value={item.employee_id} onValueChange={(v) => updateItem(item.key, "employee_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {activeEmployees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Projeto */}
                  <div className="space-y-1">
                    <Label className="text-xs">Projeto</Label>
                    <Select value={item.project_id} onValueChange={(v) => updateItem(item.key, "project_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Tipo */}
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo *</Label>
                    <Select value={item.expense_type} onValueChange={(v) => updateItem(item.key, "expense_type", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Natureza */}
                  <div className="space-y-1">
                    <Label className="text-xs">Natureza *</Label>
                    <Select value={item.nature} onValueChange={(v) => updateItem(item.key, "nature", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="adiantamento">
                          <Badge className="bg-blue-600 hover:bg-blue-700 text-white">Adiantamento</Badge>
                        </SelectItem>
                        <SelectItem value="reembolso">
                          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white">Reembolso</Badge>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Descrição */}
                <div className="space-y-1">
                  <Label className="text-xs">Descrição do Período *</Label>
                  <Textarea
                    placeholder='Ex: "Café semana 23-28/03 COLGRAVATA"'
                    value={item.description}
                    onChange={(e) => updateItem(item.key, "description", e.target.value)}
                    className="min-h-[60px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Valor */}
                  <div className="space-y-1">
                    <Label className="text-xs">Valor (R$) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.total_value || ""}
                      onChange={(e) => updateItem(item.key, "total_value", parseFloat(e.target.value) || 0)}
                    />
                  </div>

                  {/* Recebedor */}
                  <div className="space-y-1">
                    <Label className="text-xs">Recebedor</Label>
                    <Select value={item.actual_receiver_id} onValueChange={(v) => updateItem(item.key, "actual_receiver_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Mesmo funcionário" /></SelectTrigger>
                      <SelectContent>
                        {activeEmployees.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Motivo intermediário */}
                {item.actual_receiver_id && item.actual_receiver_id !== item.employee_id && (
                  <div className="space-y-1">
                    <Label className="text-xs">Motivo do Intermediário</Label>
                    <Input
                      placeholder="Motivo do pagamento via intermediário"
                      value={item.intermediary_reason}
                      onChange={(e) => updateItem(item.key, "intermediary_reason", e.target.value)}
                    />
                  </div>
                )}

                {/* Nature badge preview */}
                <div className="flex items-center gap-2">
                  <Badge className={item.nature === "adiantamento"
                    ? "bg-blue-600 text-white"
                    : "bg-emerald-600 text-white"
                  }>
                    {item.nature === "adiantamento" ? "ADIANTAMENTO" : "REEMBOLSO"}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {item.nature === "adiantamento" ? "Pago antes — ajustável/estornável" : "Já gasto pelo funcionário — irreversível"}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <Separator />

          {/* Total */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <span className="font-semibold text-foreground">Total</span>
            <span className="text-lg font-bold text-foreground">
              {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </span>
          </div>
        </div>

        <SheetFooter className="flex gap-2 pt-4">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={isPending}>
            Salvar Rascunho
          </Button>
          <Button onClick={() => handleSave(true)} disabled={isPending}>
            Submeter para Aprovação
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
