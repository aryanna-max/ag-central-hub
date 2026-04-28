import { useState } from "react";
import {
  useComplianceExecutions,
  useGenerateMonthExecutions,
  useCompleteExecution,
  useReopenExecution,
} from "@/hooks/useComplianceTasks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { CheckCircle2, RotateCcw, Plus } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, startOfMonth } from "date-fns";

type ComplianceExecutionRow = {
  id: string;
  completed_at: string | null;
  monthly_compliance_tasks?: {
    title?: string | null;
    description?: string | null;
    due_day?: number | null;
    clients?: { name?: string | null } | null;
  } | null;
};

export default function CalendarioMensal() {
  const today = new Date();
  const defaultMonth = format(startOfMonth(today), "yyyy-MM-dd");
  const [referenceMonth, setReferenceMonth] = useState(defaultMonth);

  const { data: executions = [], isLoading } =
    useComplianceExecutions(referenceMonth);
  const generate = useGenerateMonthExecutions();
  const complete = useCompleteExecution();
  const reopen = useReopenExecution();

  const todayDay = today.getDate();
  const sameMonth = referenceMonth === defaultMonth;

  async function handleGenerate() {
    try {
      const r = await generate.mutateAsync(referenceMonth);
      toast.success(`${r.count} tarefas geradas/atualizadas para o mês`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao gerar calendário";
      toast.error(msg);
    }
  }

  async function handleComplete(id: string) {
    try {
      await complete.mutateAsync({ id, referenceMonth });
      toast.success("Tarefa concluída");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      toast.error(msg);
    }
  }

  async function handleReopen(id: string) {
    try {
      await reopen.mutateAsync({ id, referenceMonth });
      toast.success("Tarefa reaberta");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro";
      toast.error(msg);
    }
  }

  const rows = executions as ComplianceExecutionRow[];
  const completed = rows.filter((e) => e.completed_at).length;
  const total = rows.length;

  function handleMonthInputChange(value: string) {
    if (!value) return;
    setReferenceMonth(`${value}-01`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <Label>Mês de referência</Label>
          <Input
            type="month"
            value={referenceMonth.slice(0, 7)}
            onChange={(e) => handleMonthInputChange(e.target.value)}
          />
        </div>
        <Button
          onClick={handleGenerate}
          disabled={generate.isPending}
          className="self-end"
        >
          <Plus className="w-4 h-4 mr-1" /> Gerar calendário do mês
        </Button>
        <div className="ml-auto self-end text-sm text-muted-foreground">
          <strong>{completed}</strong> de <strong>{total}</strong> tarefas
          concluídas
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma execução para este mês. Clique em "Gerar calendário do mês"
          para criar a partir dos templates.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Dia</TableHead>
              <TableHead>Tarefa</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((ex) => {
              const tpl = ex.monthly_compliance_tasks;
              const due = tpl?.due_day;
              const done = !!ex.completed_at;
              const overdue = sameMonth && due && due < todayDay && !done;
              const rowClass = done
                ? "bg-green-50"
                : overdue
                  ? "bg-red-50"
                  : "";
              return (
                <TableRow key={ex.id} className={rowClass}>
                  <TableCell className="font-mono">{due ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {done && (
                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                      )}
                      <div>
                        <p className="font-medium">{tpl?.title ?? "—"}</p>
                        {tpl?.description && (
                          <p className="text-xs text-muted-foreground">
                            {tpl.description}
                          </p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{tpl?.clients?.name ?? "—"}</TableCell>
                  <TableCell>
                    {done ? (
                      <Badge className="bg-green-600 text-white">
                        Concluída em{" "}
                        {ex.completed_at
                          ? format(parseISO(ex.completed_at), "dd/MM")
                          : "—"}
                      </Badge>
                    ) : overdue ? (
                      <Badge className="bg-red-600 text-white">Atrasada</Badge>
                    ) : (
                      <Badge variant="outline">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {done ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReopen(ex.id)}
                      >
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reabrir
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleComplete(ex.id)}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Concluído
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
