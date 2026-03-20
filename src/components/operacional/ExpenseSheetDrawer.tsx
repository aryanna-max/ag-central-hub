import { useState, useMemo } from "react";
import { format, startOfWeek, getWeek, getYear } from "date-fns";
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

/* ── Sub-line for funcionario items ── */
interface SubLine {
  key: number;
  project_id: string;
  expense_type: string;
  nature: string;
  value: number;
}

interface FuncionarioItem {
  kind: "funcionario";
  key: number;
  employee_id: string;
  payment_method: string;
  receiver_id: string;
  intermediary_reason: string;
  lines: SubLine[];
}

interface DespesaExtraItem {
  kind: "despesa_extra";
  key: number;
  receiver_name: string;
  receiver_document: string;
  receiver_type: string;
  project_id: string;
  expense_type: string;
  description: string;
  value: number;
  payment_method: string;
}

type ItemDraft = FuncionarioItem | DespesaExtraItem;

let _nextKey = 1;
let _nextLineKey = 1;

const newSubLine = (): SubLine => ({
  key: _nextLineKey++,
  project_id: "",
  expense_type: "",
  nature: "reembolso",
  value: 0,
});

const newFuncionario = (): FuncionarioItem => ({
  kind: "funcionario",
  key: _nextKey++,
  employee_id: "",
  payment_method: "cartao",
  receiver_id: "",
  intermediary_reason: "",
  lines: [newSubLine()],
});

const newDespesaExtra = (): DespesaExtraItem => ({
  kind: "despesa_extra",
  key: _nextKey++,
  receiver_name: "",
  receiver_document: "",
  receiver_type: "",
  project_id: "",
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
  return d.length <= 11 ? "pf" : "pj";
}

function funcTotal(item: FuncionarioItem): number {
  return item.lines.reduce((s, l) => s + (Number(l.value) || 0), 0);
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
  const [items, setItems] = useState<ItemDraft[]>([]);

  const { data: employees = [] } = useEmployees();
  const { data: projects = [] } = useProjects();
  const { toast } = useToast();
  const createSheet = useCreateExpenseSheet();
  const bulkItems = useBulkCreateExpenseItems();
  const createAlerts = useCreateAlerts();

  const active = useMemo(() => {
    const list = employees.filter((e: any) => e.status !== "desligado");
    const clts = list.filter((e: any) => e.role !== "Prestador de Serviço");
    const prest = list.filter((e: any) => e.role === "Prestador de Serviço");
    return [...clts, ...prest];
  }, [employees]);

  const total = items.reduce((s, i) => {
    if (i.kind === "funcionario") return s + funcTotal(i);
    return s + (Number(i.value) || 0);
  }, 0);

  const addFuncionario = () => setItems((prev) => [...prev, newFuncionario()]);
  const addDespesaExtra = () => setItems((prev) => [...prev, newDespesaExtra()]);
  const removeItem = (key: number) => setItems((prev) => prev.filter((i) => i.key !== key));

  const setField = (key: number, field: string, value: any) =>
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, [field]: value } : i)));

  const setFuncLine = (itemKey: number, lineKey: number, field: string, value: any) =>
    setItems((prev) => prev.map((i) => {
      if (i.key !== itemKey || i.kind !== "funcionario") return i;
      return { ...i, lines: i.lines.map((l) => l.key === lineKey ? { ...l, [field]: value } : l) };
    }));

  const addLine = (itemKey: number) =>
    setItems((prev) => prev.map((i) => {
      if (i.key !== itemKey || i.kind !== "funcionario") return i;
      return { ...i, lines: [...i.lines, newSubLine()] };
    }));

  const removeLine = (itemKey: number, lineKey: number) =>
    setItems((prev) => prev.map((i) => {
      if (i.key !== itemKey || i.kind !== "funcionario") return i;
      return { ...i, lines: i.lines.filter((l) => l.key !== lineKey) };
    }));

  const validate = (): string | null => {
    if (!periodStart || !periodEnd) return "Informe o período.";
    if (items.length === 0) return "Adicione pelo menos um item.";
    for (const item of items) {
      if (item.kind === "funcionario") {
        if (!item.employee_id) return "Selecione o funcionário em todos os itens.";
        if (item.lines.length === 0) return "Adicione pelo menos uma linha de gasto.";
        for (const line of item.lines) {
          if (!line.project_id) return "Selecione o projeto em todas as linhas.";
          if (!line.expense_type) return "Selecione o tipo de gasto em todas as linhas.";
          if (!line.value || line.value <= 0) return "Informe o valor em todas as linhas.";
        }
      } else {
        if (!item.receiver_name.trim()) return "Informe o nome/razão social em todas as despesas extras.";
        if (item.receiver_document.replace(/\D/g, "").length < 11) return "CPF/CNPJ inválido em despesa extra.";
        if (!item.description.trim()) return "Preencha a descrição em todas as despesas extras.";
        if (!item.project_id) return "Selecione o projeto na despesa extra.";
        if (!item.expense_type) return "Selecione o tipo de gasto na despesa extra.";
        if (!item.value || item.value <= 0) return "Informe o valor na despesa extra.";
      }
    }
    return null;
  };

  const findEmployeeByName = async (pattern: string) => {
    const { data } = await (await import("@/integrations/supabase/client")).supabase
      .from("employees")
      .select("id, name")
      .ilike("name", pattern)
      .limit(1);
    return data?.[0] ?? null;
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

      // Flatten funcionario items into individual DB rows per sub-line
      const dbItems: any[] = [];
      const allProjectNames: string[] = [];

      for (const item of items) {
        if (item.kind === "funcionario") {
          for (const line of item.lines) {
            const projName = projects.find((p) => p.id === line.project_id)?.name ?? "";
            if (projName && !allProjectNames.includes(projName)) allProjectNames.push(projName);
            dbItems.push({
              sheet_id: sheet.id,
              item_type: "funcionario",
              employee_id: item.employee_id,
              project_id: line.project_id,
              project_name: projName,
              expense_type: line.expense_type,
              nature: line.nature,
              description: `${line.expense_type} — ${projName}`,
              value: line.value,
              payment_method: item.payment_method,
              receiver_id: item.receiver_id || null,
              receiver_name: item.receiver_id ? active.find((e: any) => e.id === item.receiver_id)?.name || null : null,
              intermediary_reason: item.receiver_id && item.receiver_id !== item.employee_id ? item.intermediary_reason : null,
              fiscal_alert: false,
            });
          }
        } else {
          const projName = projects.find((p) => p.id === item.project_id)?.name ?? "";
          if (projName && !allProjectNames.includes(projName)) allProjectNames.push(projName);
          dbItems.push({
            sheet_id: sheet.id,
            item_type: "despesa_extra",
            employee_id: active[0]?.id ?? "",
            project_id: item.project_id,
            project_name: projName,
            expense_type: item.expense_type,
            nature: "reembolso",
            description: item.description,
            value: item.value,
            payment_method: item.payment_method,
            receiver_name: item.receiver_name,
            receiver_document: item.receiver_document.replace(/\D/g, ""),
            receiver_type: detectType(item.receiver_document),
            fiscal_alert: true,
          });
        }
      }

      await bulkItems.mutateAsync(dbItems);

      // Alerts for despesa_extra → Alcione
      const extraItems = items.filter((i) => i.kind === "despesa_extra") as DespesaExtraItem[];
      if (extraItems.length > 0) {
        const alcione = await findEmployeeByName("%Alcione%");
        const alerts: AlertInsert[] = extraItems.map((ei) => {
          const projName = projects.find((p) => p.id === ei.project_id)?.name ?? "";
          return {
            alert_type: "despesa_campo",
            recipient: "financeiro" as const,
            priority: "urgente" as const,
            title: "⚠️ Despesa extra — conferir NF/Recibo",
            message: `${ei.receiver_name} — ${ei.expense_type} R$${ei.value.toFixed(2)} — Doc: ${ei.receiver_document} — Projeto: ${projName} — Folha: ${weekLabel}`,
            reference_type: "expense_sheet",
            reference_id: sheet.id,
            action_type: "conferir_recibo",
            action_label: "Conferir e marcar OK",
            action_url: "/operacional/despesas-de-campo",
            ...(alcione ? { assigned_to: alcione.id } : {}),
          };
        });
        await createAlerts.mutateAsync(alerts);
      }

      // Alerts when submitting
      if (submit) {
        const [sergio, alcione] = await Promise.all([
          findEmployeeByName("%Sergio%Gonzaga%"),
          findEmployeeByName("%Alcione%"),
        ]);

        const projList = allProjectNames.join(", ") || "—";
        const totalStr = total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

        const submitAlerts: AlertInsert[] = [];

        if (sergio) {
          submitAlerts.push({
            alert_type: "despesa_campo",
            recipient: "operacional",
            priority: "urgente",
            title: "📋 Folha aguardando sua aprovação",
            message: `Folha ${weekLabel} — Total: ${totalStr} — Projetos: ${projList}`,
            reference_type: "expense_sheet",
            reference_id: sheet.id,
            action_type: "aprovar",
            action_url: "/operacional/despesas-de-campo",
            action_label: "Aprovar folha",
            assigned_to: sergio.id,
          });
        }

        if (alcione) {
          submitAlerts.push({
            alert_type: "despesa_campo",
            recipient: "financeiro",
            priority: "importante",
            title: "📋 Nova folha de despesas submetida",
            message: `Folha ${weekLabel} — Total: ${totalStr} — Aguardando aprovação de Sérgio.`,
            reference_type: "expense_sheet",
            reference_id: sheet.id,
            action_type: "visualizar",
            action_url: "/operacional/despesas-de-campo",
            action_label: "Ver folha",
            assigned_to: alcione.id,
          });
        }

        if (submitAlerts.length > 0) {
          await createAlerts.mutateAsync(submitAlerts);
        }

        toast({ title: `✅ Folha ${weekLabel} submetida. Sérgio foi notificado para aprovação.` });
      } else {
        toast({ title: "Rascunho salvo" });
      }

      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    }
  };

  const reset = () => {
    setPeriodStart(format(monday, "yyyy-MM-dd"));
    setPeriodEnd(format(saturday, "yyyy-MM-dd"));
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
                  projects={projects}
                  onSet={(f, v) => setField(item.key, f, v)}
                  onSetLine={(lk, f, v) => setFuncLine(item.key, lk, f, v)}
                  onAddLine={() => addLine(item.key)}
                  onRemoveLine={(lk) => removeLine(item.key, lk)}
                  onRemove={() => removeItem(item.key)}
                />
              ) : (
                <DespesaExtraCard
                  key={item.key}
                  item={item}
                  idx={idx}
                  projects={projects}
                  onSet={(f, v) => setField(item.key, f, v)}
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

/* ── Funcionario Card with multi-line sub-items ── */

function FuncionarioCard({
  item, idx, employees, projects, onSet, onSetLine, onAddLine, onRemoveLine, onRemove,
}: {
  item: FuncionarioItem;
  idx: number;
  employees: Array<{ id: string; name: string; role: string }>;
  projects: Array<{ id: string; name: string }>;
  onSet: (f: string, v: any) => void;
  onSetLine: (lineKey: number, f: string, v: any) => void;
  onAddLine: () => void;
  onRemoveLine: (lineKey: number) => void;
  onRemove: () => void;
}) {
  const itemTotal = funcTotal(item);

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

      {/* Sub-lines */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-semibold">Linhas de Gasto</Label>
          <Button size="sm" variant="outline" className="h-6 text-xs px-2" onClick={onAddLine}>
            <Plus className="w-3 h-3 mr-1" /> Linha
          </Button>
        </div>

        {item.lines.map((line, li) => (
          <div key={line.key} className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-2 items-end bg-background p-2 rounded border border-border">
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Projeto</Label>
              <Select value={line.project_id} onValueChange={(v) => onSetLine(line.key, "project_id", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Projeto" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Tipo de Gasto</Label>
              <Select value={line.expense_type} onValueChange={(v) => onSetLine(line.key, "expense_type", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                <SelectContent>
                  {EXPENSE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Nat.</Label>
              <Select value={line.nature} onValueChange={(v) => onSetLine(line.key, "nature", v)}>
                <SelectTrigger className="h-8 text-xs w-[90px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="adiantamento">Adiant.</SelectItem>
                  <SelectItem value="reembolso">Reemb.</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[10px] text-muted-foreground">Valor</Label>
              <Input
                type="number" step="0.01" min="0"
                className="h-8 text-xs w-[90px]"
                value={line.value || ""}
                onChange={(e) => onSetLine(line.key, "value", parseFloat(e.target.value) || 0)}
              />
            </div>
            {item.lines.length > 1 && (
              <Button size="icon" variant="ghost" className="h-8 w-8 mt-4" onClick={() => onRemoveLine(line.key)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        ))}
      </div>

      {/* Total + recebedor */}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          {item.lines.some(l => l.nature === "adiantamento") && (
            <Badge className="bg-blue-600 hover:bg-blue-700 text-white text-[10px]">ADIANTAMENTO</Badge>
          )}
          {item.lines.some(l => l.nature === "reembolso") && (
            <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white text-[10px]">REEMBOLSO</Badge>
          )}
        </div>
        <div className="text-sm font-bold text-foreground">
          Total: {itemTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
        </div>
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
    </div>
  );
}

/* ── Despesa Extra Card ── */

function DespesaExtraCard({
  item, idx, projects, onSet, onRemove,
}: {
  item: DespesaExtraItem;
  idx: number;
  projects: Array<{ id: string; name: string }>;
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
          <Label className="text-xs">Projeto *</Label>
          <Select value={item.project_id} onValueChange={(v) => onSet("project_id", v)}>
            <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
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
      </div>

      <div className="grid grid-cols-2 gap-3">
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
        <div className="space-y-1">
          <Label className="text-xs">Valor (R$) *</Label>
          <Input
            type="number" step="0.01" min="0"
            value={item.value || ""}
            onChange={(e) => onSet("value", parseFloat(e.target.value) || 0)}
          />
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
    </div>
  );
}
