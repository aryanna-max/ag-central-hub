import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2 } from "lucide-react";
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
import { useProjects } from "@/hooks/useProjects";
import { useCreateAlerts, type AlertInsert } from "@/hooks/useAlerts";
import {
  useCreateExpenseSheet,
  useBulkCreateExpenseItems,
  EXPENSE_TYPES,
} from "@/hooks/useExpenseSheets";

interface ItemDraft {
  key: number;
  employee_id: string;
  project_id: string;
  expense_type: string;
  nature: string;
  description: string;
  value: number;
  receiver_id: string;
  intermediary_reason: string;
}

const newItem = (key: number): ItemDraft => ({
  key,
  employee_id: "",
  project_id: "",
  expense_type: "",
  nature: "reembolso",
  description: "",
  value: 0,
  receiver_id: "",
  intermediary_reason: "",
});

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function ExpenseSheetDrawer({ open, onOpenChange }: Props) {
  const [weekRef, setWeekRef] = useState("");
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([newItem(1)]);
  const [nextKey, setNextKey] = useState(2);

  const { data: employees = [] } = useEmployees();
  const { data: projects = [] } = useProjects();
  const { toast } = useToast();
  const createSheet = useCreateExpenseSheet();
  const bulkItems = useBulkCreateExpenseItems();
  const createAlerts = useCreateAlerts();

  const active = employees.filter((e) => e.status !== "desligado");
  const total = items.reduce((s, i) => s + (Number(i.value) || 0), 0);

  const addItem = () => {
    setItems((prev) => [...prev, newItem(nextKey)]);
    setNextKey((k) => k + 1);
  };

  const removeItem = (key: number) => {
    if (items.length <= 1) return;
    setItems((prev) => prev.filter((i) => i.key !== key));
  };

  const set = (key: number, field: keyof ItemDraft, value: any) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, [field]: value } : i)));

  const validate = (): string | null => {
    if (!weekRef.trim()) return "Informe a semana de referência.";
    if (!periodStart || !periodEnd) return "Informe o período.";
    for (const item of items) {
      if (!item.employee_id) return "Selecione o funcionário em todos os itens.";
      if (!item.expense_type) return "Selecione o tipo em todos os itens.";
      if (!item.description.trim()) return "Preencha a descrição em todos os itens.";
      if (!item.value || item.value <= 0) return "Informe o valor em todos os itens.";
    }
    return null;
  };

  const save = async (submit: boolean) => {
    const err = validate();
    if (err) return toast({ title: err, variant: "destructive" });

    try {
      const sheet = await createSheet.mutateAsync({
        week_ref: weekRef,
        period_start: periodStart,
        period_end: periodEnd,
        total_value: total,
        status: submit ? "submetido" : "rascunho",
      });

      await bulkItems.mutateAsync(
        items.map((i) => ({
          sheet_id: sheet.id,
          employee_id: i.employee_id,
          project_id: i.project_id || null,
          project_name: projects.find((p) => p.id === i.project_id)?.name || null,
          expense_type: i.expense_type,
          nature: i.nature,
          description: i.description,
          value: i.value,
          receiver_id: i.receiver_id || null,
          receiver_name: i.receiver_id ? active.find((e) => e.id === i.receiver_id)?.name || null : null,
          intermediary_reason:
            i.receiver_id && i.receiver_id !== i.employee_id ? i.intermediary_reason : null,
        }))
      );

      if (submit) {
        const label = `${format(new Date(periodStart + "T12:00:00"), "dd/MM", { locale: ptBR })} – ${format(new Date(periodEnd + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}`;
        await createAlerts.mutateAsync([
          {
            alert_type: "despesa_campo",
            recipient: "diretoria",
            priority: "importante",
            title: "Nova folha de despesas submetida",
            message: `Ref.: ${weekRef} • Período ${label} • Total: ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
            reference_type: "expense_sheet",
            reference_id: sheet.id,
          } as AlertInsert,
        ]);
      }

      toast({ title: submit ? "Folha submetida para aprovação" : "Rascunho salvo" });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const reset = () => {
    setWeekRef("");
    setPeriodStart("");
    setPeriodEnd("");
    setItems([newItem(1)]);
    setNextKey(2);
  };

  const busy = createSheet.isPending || bulkItems.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nova Folha de Despesas de Campo</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Header fields */}
          <div className="space-y-2">
            <Label>Semana de Referência</Label>
            <Input
              placeholder='Ex: "Semana 23-28/03"'
              value={weekRef}
              onChange={(e) => setWeekRef(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Início do Período</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Fim do Período</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>

          <Separator />

          {/* Items */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Itens da Folha</h3>
              <Button size="sm" variant="outline" onClick={addItem}>
                <Plus className="w-4 h-4 mr-1" /> Item
              </Button>
            </div>

            {items.map((item, idx) => (
              <div key={item.key} className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">Item {idx + 1}</span>
                  {items.length > 1 && (
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => removeItem(item.key)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Funcionário *</Label>
                    <Select value={item.employee_id} onValueChange={(v) => set(item.key, "employee_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {active.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Projeto</Label>
                    <Select value={item.project_id} onValueChange={(v) => set(item.key, "project_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {projects.map((p) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Tipo *</Label>
                    <Select value={item.expense_type} onValueChange={(v) => set(item.key, "expense_type", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        {EXPENSE_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>{t}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Natureza *</Label>
                    <Select value={item.nature} onValueChange={(v) => set(item.key, "nature", v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="adiantamento">Adiantamento</SelectItem>
                        <SelectItem value="reembolso">Reembolso</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <Label className="text-xs">Descrição do Período *</Label>
                  <Textarea
                    placeholder='Ex: "Café semana 23-28/03 COLGRAVATA" ou "Pedágio dia 22/03 rodovia Gravatá — NF anexa"'
                    value={item.description}
                    onChange={(e) => set(item.key, "description", e.target.value)}
                    className="min-h-[56px]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Valor (R$) *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={item.value || ""}
                      onChange={(e) => set(item.key, "value", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Recebedor</Label>
                    <Select value={item.receiver_id} onValueChange={(v) => set(item.key, "receiver_id", v)}>
                      <SelectTrigger><SelectValue placeholder="Mesmo funcionário" /></SelectTrigger>
                      <SelectContent>
                        {active.map((e) => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {item.receiver_id && item.receiver_id !== item.employee_id && (
                  <div className="space-y-1">
                    <Label className="text-xs">Motivo do Intermediário</Label>
                    <Input
                      placeholder="Por que o pagamento é via intermediário?"
                      value={item.intermediary_reason}
                      onChange={(e) => set(item.key, "intermediary_reason", e.target.value)}
                    />
                  </div>
                )}

                {/* Nature badge */}
                <div className="flex items-center gap-2 pt-1">
                  {item.nature === "adiantamento" ? (
                    <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[10px]">ADIANTAMENTO</Badge>
                  ) : (
                    <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]">REEMBOLSO</Badge>
                  )}
                  <span className="text-[10px] text-muted-foreground">
                    {item.nature === "adiantamento"
                      ? "Pago antes — ajustável / estornável"
                      : "Já gasto pelo funcionário — irreversível"}
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

        <SheetFooter className="flex gap-2 pt-4 border-t border-border">
          <Button variant="outline" onClick={() => save(false)} disabled={busy}>
            Salvar Rascunho
          </Button>
          <Button onClick={() => save(true)} disabled={busy}>
            Submeter para Aprovação
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
