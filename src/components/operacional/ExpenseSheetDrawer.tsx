import { useState, useMemo, useEffect } from "react";
import { format, startOfWeek, endOfWeek, getWeek, getYear } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Plus, Trash2, User, Receipt } from "lucide-react";
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
  PAYMENT_METHODS,
} from "@/hooks/useExpenseSheets";

/* ── Draft types ── */

interface FuncionarioItem {
  kind: "funcionario";
  key: number;
  employee_id: string;
  expense_type: string;
  nature: string;
  description: string;
  value: number;
  payment_method: string;
  receiver_id: string;
  intermediary_reason: string;
}

interface DespesaExtraItem {
  kind: "despesa_extra";
  key: number;
  receiver_name: string;
  receiver_document: string;
  receiver_type: string;
  expense_type: string;
  description: string;
  value: number;
  payment_method: string;
}

type ItemDraft = FuncionarioItem | DespesaExtraItem;

let _nextKey = 1;

const newFuncionario = (): FuncionarioItem => ({
  kind: "funcionario",
  key: _nextKey++,
  employee_id: "",
  expense_type: "",
  nature: "reembolso",
  description: "",
  value: 0,
  payment_method: "cartao",
  receiver_id: "",
  intermediary_reason: "",
});

const newDespesaExtra = (): DespesaExtraItem => ({
  kind: "despesa_extra",
  key: _nextKey++,
  receiver_name: "",
  receiver_document: "",
  receiver_type: "",
  expense_type: "",
  description: "",
  value: 0,
  payment_method: "cartao",
});

/* ── Helpers ── */
function formatDoc(v: string) {
  const d = v.replace(/\D/g, "").slice(0, 14);
  if (d.length <= 11) return d.replace(/(\d{3})(\d{3})?(\d{3})?(\d{0,2})?/, (_m, a, b, c, e) =>
    [a, b, c].filter(Boolean).join(".") + (e ? `-${e}` : ""));
  return d.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{0,2})/, "$1.$2.$3/$4-$5");
}

function detectType(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length <= 11) return "pf";
  return "pj";
}

/* ── Component ── */

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function ExpenseSheetDrawer({ open, onOpenChange }: Props) {
  const now = new Date();
  const weekNum = getWeek(now, { weekStartsOn: 1 });
  const weekYr = getYear(now);
  const weekLabel = String(weekNum).padStart(3, "0") + "/" + String(weekYr % 100);

  const monday = startOfWeek(now, { weekStartsOn: 1 });
  const saturday = new Date(monday);
  saturday.setDate(monday.getDate() + 5);

  const [periodStart, setPeriodStart] = useState(format(monday, "yyyy-MM-dd"));
  const [periodEnd, setPeriodEnd] = useState(format(saturday, "yyyy-MM-dd"));
  const [projectId, setProjectId] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([]);

  const { data: employees = [] } = useEmployees();
  const { data: projects = [] } = useProjects();
  const { toast } = useToast();
  const createSheet = useCreateExpenseSheet();
  const bulkItems = useBulkCreateExpenseItems();
  const createAlerts = useCreateAlerts();

  const active = useMemo(() => {
    const list = employees.filter((e) => e.status !== "desligado");
    const clts = list.filter((e) => e.role !== "Prestador de Serviço");
    const prest = list.filter((e) => e.role === "Prestador de Serviço");
    return [...clts, ...prest];
  }, [employees]);

  const projectName = projects.find((p) => p.id === projectId)?.name ?? "";
  const total = items.reduce((s, i) => s + (Number(i.value) || 0), 0);

  const addFuncionario = () => setItems((prev) => [...prev, newFuncionario()]);
  const addDespesaExtra = () => setItems((prev) => [...prev, newDespesaExtra()]);
  const removeItem = (key: number) => setItems((prev) => prev.filter((i) => i.key !== key));

  const set = (key: number, field: string, value: any) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, [field]: value } : i)));

  const validate = (): string | null => {
    if (!periodStart || !periodEnd) return "Informe o período.";
    if (!projectId) return "Selecione o projeto da folha.";
    if (items.length === 0) return "Adicione pelo menos um item.";
    for (const item of items) {
      if (item.kind === "funcionario") {
        if (!item.employee_id) return "Selecione o funcionário em todos os itens.";
      } else {
        if (!item.receiver_name.trim()) return "Informe o nome/razão social em todas as despesas extras.";
        if (item.receiver_document.replace(/\D/g, "").length < 11) return "CPF/CNPJ inválido em despesa extra.";
        if (!item.description.trim()) return "Preencha a descrição em todas as despesas extras.";
      }
      if (!item.expense_type) return "Selecione o tipo de gasto em todos os itens.";
      if (!item.value || item.value <= 0) return "Informe o valor em todos os itens.";
    }
    return null;
  };

  const save = async (submit: boolean) => {
    const err = validate();
    if (err) return toast({ title: err, variant: "destructive" });

    try {
      const sheet = await createSheet.mutateAsync({
        week_number: weekNum,
        week_year: weekYr,
        period_start: periodStart,
        period_end: periodEnd,
        total_value: total,
        status: submit ? "submetido" : "rascunho",
      });

      const dbItems = items.map((item) => {
        if (item.kind === "funcionario") {
          return {
            sheet_id: sheet.id,
            item_type: "funcionario" as const,
            employee_id: item.employee_id,
            project_id: projectId,
            project_name: projectName,
            expense_type: item.expense_type,
            nature: item.nature,
            description: item.description || `${item.expense_type} — ${projectName}`,
            value: item.value,
            payment_method: item.payment_method,
            receiver_id: item.receiver_id || null,
            receiver_name: item.receiver_id ? active.find((e) => e.id === item.receiver_id)?.name || null : null,
            intermediary_reason: item.receiver_id && item.receiver_id !== item.employee_id ? item.intermediary_reason : null,
            fiscal_alert: false,
          };
        } else {
          return {
            sheet_id: sheet.id,
            item_type: "despesa_extra" as const,
            employee_id: active[0]?.id ?? "", // placeholder
            project_id: projectId,
            project_name: projectName,
            expense_type: item.expense_type,
            nature: "reembolso",
            description: item.description,
            value: item.value,
            payment_method: item.payment_method,
            receiver_name: item.receiver_name,
            receiver_document: item.receiver_document.replace(/\D/g, ""),
            receiver_type: detectType(item.receiver_document),
            fiscal_alert: true,
          };
        }
      });

      await bulkItems.mutateAsync(dbItems);

      // Alert for despesa_extra items
      const extraItems = items.filter((i) => i.kind === "despesa_extra") as DespesaExtraItem[];
      if (extraItems.length > 0) {
        const alerts: AlertInsert[] = extraItems.map((ei) => ({
          alert_type: "despesa_campo",
          recipient: "financeiro" as const,
          priority: "urgente" as const,
          title: "Despesa Extra — conferir NF/Recibo",
          message: `${ei.receiver_name} — ${ei.expense_type} R$${ei.value.toFixed(2)} — Projeto: ${projectName} — Doc: ${ei.receiver_document}`,
          reference_type: "expense_sheet",
          reference_id: sheet.id,
        }));
        await createAlerts.mutateAsync(alerts);
      }

      if (submit) {
        const label = `${format(new Date(periodStart + "T12:00:00"), "dd/MM", { locale: ptBR })} – ${format(new Date(periodEnd + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR })}`;
        await createAlerts.mutateAsync([{
          alert_type: "despesa_campo",
          recipient: "diretoria",
          priority: "importante",
          title: "Nova folha de despesas submetida",
          message: `Ref.: ${weekLabel} • Período ${label} • Total: ${total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
          reference_type: "expense_sheet",
          reference_id: sheet.id,
        } as AlertInsert]);
      }

      toast({ title: submit ? "Folha submetida para aprovação" : "Rascunho salvo" });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const reset = () => {
    setPeriodStart(format(monday, "yyyy-MM-dd"));
    setPeriodEnd(format(saturday, "yyyy-MM-dd"));
    setProjectId("");
    setItems([]);
  };

  const busy = createSheet.isPending || bulkItems.isPending;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Nova Folha de Despesas de Campo</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Semana automática */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Semana de Referência</Label>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-base font-mono px-3 py-1">{weekLabel}</Badge>
              <span className="text-xs text-muted-foreground">(preenchida automaticamente)</span>
            </div>
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

          <div className="space-y-2">
            <Label>Projeto *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Selecione o projeto" /></SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Separator />

          {/* Add buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" onClick={addFuncionario} className="bg-blue-600 hover:bg-blue-700 text-white">
              <User className="w-4 h-4 mr-1" /> Adicionar Funcionário
            </Button>
            <Button size="sm" onClick={addDespesaExtra} className="bg-orange-500 hover:bg-orange-600 text-white">
              <Receipt className="w-4 h-4 mr-1" /> Despesa Extra
            </Button>
          </div>

          {/* Items */}
          <div className="space-y-4">
            {items.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum item adicionado. Use os botões acima.</p>
            )}

            {items.map((item, idx) => (
              item.kind === "funcionario" ? (
                <FuncionarioCard
                  key={item.key}
                  item={item}
                  idx={idx}
                  employees={active}
                  onSet={(f, v) => set(item.key, f, v)}
                  onRemove={() => removeItem(item.key)}
                />
              ) : (
                <DespesaExtraCard
                  key={item.key}
                  item={item}
                  idx={idx}
                  projectName={projectName}
                  onSet={(f, v) => set(item.key, f, v)}
                  onRemove={() => removeItem(item.key)}
                />
              )
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

/* ── Funcionario Card ── */

function FuncionarioCard({
  item, idx, employees, onSet, onRemove,
}: {
  item: FuncionarioItem;
  idx: number;
  employees: Array<{ id: string; name: string; role: string }>;
  onSet: (f: string, v: any) => void;
  onRemove: () => void;
}) {
  return (
    <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-blue-600 text-white text-[10px]">FUNCIONÁRIO</Badge>
          <span className="text-xs text-muted-foreground">Item {idx + 1}</span>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onRemove}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Funcionário *</Label>
          <Select value={item.employee_id} onValueChange={(v) => onSet("employee_id", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}{e.role === "Prestador de Serviço" ? " (Prestador)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Tipo de Gasto *</Label>
          <Select value={item.expense_type} onValueChange={(v) => onSet("expense_type", v)}>
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
          <Select value={item.nature} onValueChange={(v) => onSet("nature", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="adiantamento">Adiantamento</SelectItem>
              <SelectItem value="reembolso">Reembolso</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Forma de Pagamento *</Label>
          <Select value={item.payment_method} onValueChange={(v) => onSet("payment_method", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.icon} {m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Valor (R$) *</Label>
          <Input
            type="number" step="0.01" min="0"
            value={item.value || ""}
            onChange={(e) => onSet("value", parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Total do Item</Label>
          <div className="h-9 px-3 flex items-center rounded-md border bg-muted text-sm font-semibold">
            {(item.value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Descrição</Label>
        <Textarea
          placeholder="Ex: Café semana 23-28/03 COLGRAVATA"
          value={item.description}
          onChange={(e) => onSet("description", e.target.value)}
          className="min-h-[48px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Recebedor (se diferente)</Label>
          <Select value={item.receiver_id} onValueChange={(v) => onSet("receiver_id", v)}>
            <SelectTrigger><SelectValue placeholder="Mesmo funcionário" /></SelectTrigger>
            <SelectContent>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {item.receiver_id && item.receiver_id !== item.employee_id && (
          <div className="space-y-1">
            <Label className="text-xs">Motivo Intermediário</Label>
            <Input
              placeholder="Motivo"
              value={item.intermediary_reason}
              onChange={(e) => onSet("intermediary_reason", e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 pt-1">
        {item.nature === "adiantamento" ? (
          <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[10px]">ADIANTAMENTO</Badge>
        ) : (
          <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]">REEMBOLSO</Badge>
        )}
        <span className="text-[10px] text-muted-foreground">
          {item.nature === "adiantamento" ? "Pago antes — ajustável / estornável" : "Já gasto pelo funcionário — irreversível"}
        </span>
      </div>
    </div>
  );
}

/* ── Despesa Extra Card ── */

function DespesaExtraCard({
  item, idx, projectName, onSet, onRemove,
}: {
  item: DespesaExtraItem;
  idx: number;
  projectName: string;
  onSet: (f: string, v: any) => void;
  onRemove: () => void;
}) {
  const handleDocChange = (v: string) => {
    const formatted = formatDoc(v);
    onSet("receiver_document", formatted);
    onSet("receiver_type", detectType(v));
  };

  const docDigits = item.receiver_document.replace(/\D/g, "").length;

  return (
    <div className="border-2 border-orange-400 rounded-lg p-4 space-y-3 bg-orange-50 dark:bg-orange-950/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge className="bg-orange-500 text-white text-[10px]">DESPESA EXTRA</Badge>
          <Badge variant="destructive" className="text-[10px]">⚠️ AGUARDA NF/RECIBO</Badge>
          <span className="text-xs text-muted-foreground">Item {idx + 1}</span>
        </div>
        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onRemove}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Nome / Razão Social *</Label>
          <Input
            placeholder="Nome ou razão social"
            value={item.receiver_name}
            onChange={(e) => onSet("receiver_name", e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">CPF ou CNPJ *</Label>
          <Input
            placeholder="000.000.000-00"
            value={item.receiver_document}
            onChange={(e) => handleDocChange(e.target.value)}
          />
          {docDigits >= 11 && (
            <span className="text-[10px] text-muted-foreground">
              Tipo: {item.receiver_type === "pj" ? "PJ (CNPJ)" : "PF (CPF)"}
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tipo de Gasto *</Label>
          <Select value={item.expense_type} onValueChange={(v) => onSet("expense_type", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {EXPENSE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Forma de Pagamento *</Label>
          <Select value={item.payment_method} onValueChange={(v) => onSet("payment_method", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.icon} {m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Descrição *</Label>
        <Textarea
          placeholder='Ex: "Depósito pousada Gravata período 12-18/01/2026"'
          value={item.description}
          onChange={(e) => onSet("description", e.target.value)}
          className="min-h-[56px]"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Valor (R$) *</Label>
          <Input
            type="number" step="0.01" min="0"
            value={item.value || ""}
            onChange={(e) => onSet("value", parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Projeto</Label>
          <div className="h-9 px-3 flex items-center rounded-md border bg-muted text-sm text-muted-foreground">
            {projectName || "—"}
          </div>
        </div>
      </div>
    </div>
  );
}
