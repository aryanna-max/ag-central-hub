import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import {
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Filter,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  useComplianceSummary,
  EMPRESA_LABELS,
  type VencimentoUnificado,
  type TarefaAtrasadaItem,
} from "@/hooks/useComplianceSummary";
import { DOC_TYPE_LABELS } from "@/hooks/useEmployeeDocuments";
import { useCompleteExecution } from "@/hooks/useComplianceTasks";

type PendenciaSeveridade = "vencido" | "vencendo" | "atrasada";
type PendenciaTipo = "doc_empresa" | "doc_funcionario" | "integracao" | "tarefa";

interface PendenciaAcaoNavigate {
  type: "navigate";
  label: string;
  target: string;
}
interface PendenciaAcaoConcluir {
  type: "complete";
  label: string;
  executionId: string;
  referenceMonth: string;
}

interface Pendencia {
  key: string;
  severidade: PendenciaSeveridade;
  tipo: PendenciaTipo;
  tipoLabel: string;
  item: string;
  contexto?: string;
  vencimento: string;
  dias: number;
  responsavel: string;
  acao: PendenciaAcaoNavigate | PendenciaAcaoConcluir;
}

const TIPO_LABELS: Record<PendenciaTipo, string> = {
  doc_empresa: "Doc empresa",
  doc_funcionario: "Doc funcionário",
  integracao: "Integração",
  tarefa: "Tarefa mensal",
};

const SEVERIDADE_BADGE: Record<PendenciaSeveridade, string> = {
  vencido: "bg-red-600 text-white",
  atrasada: "bg-red-600 text-white",
  vencendo: "bg-amber-500 text-white",
};

function buildVencimentoPendencia(v: VencimentoUnificado): Pendencia | null {
  if (v.days_until > 30) return null; // vencendo60/90 fica fora do feed
  const isVencido = v.days_until < 0;
  const severidade: PendenciaSeveridade = isVencido ? "vencido" : "vencendo";

  if (v.origem === "empresa") {
    const docLabel = v.doc_type ? DOC_TYPE_LABELS[v.doc_type] ?? v.doc_type : "—";
    return {
      key: `empresa-${v.id}`,
      severidade,
      tipo: "doc_empresa",
      tipoLabel: TIPO_LABELS.doc_empresa,
      item: docLabel,
      contexto: EMPRESA_LABELS[v.empresa ?? ""] ?? v.empresa,
      vencimento: v.expiry_date,
      dias: v.days_until,
      responsavel: "Master",
      acao: {
        type: "navigate",
        label: "Editar",
        target: "/base/governanca",
      },
    };
  }
  if (v.origem === "funcionario") {
    const docLabel = v.doc_type ? DOC_TYPE_LABELS[v.doc_type] ?? v.doc_type : "—";
    return {
      key: `funcionario-${v.id}`,
      severidade,
      tipo: "doc_funcionario",
      tipoLabel: TIPO_LABELS.doc_funcionario,
      item: docLabel,
      contexto: v.funcionario_nome,
      vencimento: v.expiry_date,
      dias: v.days_until,
      responsavel: "Financeiro",
      acao: {
        type: "navigate",
        label: "Ver",
        target: "/rh/documentos",
      },
    };
  }
  // integracao
  return {
    key: `integracao-${v.id}`,
    severidade,
    tipo: "integracao",
    tipoLabel: TIPO_LABELS.integracao,
    item: v.cliente_nome ?? "—",
    contexto: v.funcionario_nome,
    vencimento: v.expiry_date,
    dias: v.days_until,
    responsavel: "Financeiro",
    acao: {
      type: "navigate",
      label: "Ver",
      target: "/compliance/funcionarios",
    },
  };
}

function buildTarefaPendencia(t: TarefaAtrasadaItem): Pendencia {
  const refMonth = `${t.reference_year}-${String(t.reference_month).padStart(2, "0")}-01`;
  return {
    key: `tarefa-${t.id}`,
    severidade: "atrasada",
    tipo: "tarefa",
    tipoLabel: TIPO_LABELS.tarefa,
    item: t.task_title,
    contexto: t.cliente_nome ?? undefined,
    vencimento: t.due_date,
    dias: -t.days_overdue,
    responsavel: "Financeiro",
    acao: {
      type: "complete",
      label: "Concluir",
      executionId: t.id,
      referenceMonth: refMonth,
    },
  };
}

export default function Pendencias() {
  const navigate = useNavigate();
  const { data: summary, isLoading } = useComplianceSummary();
  const complete = useCompleteExecution();
  const [tipoFiltro, setTipoFiltro] = useState<PendenciaTipo | "todos">("todos");
  const [sevFiltro, setSevFiltro] = useState<PendenciaSeveridade | "todos">("todos");

  const pendencias = useMemo<Pendencia[]>(() => {
    if (!summary) return [];
    const fromVenc = summary.vencimentos
      .map(buildVencimentoPendencia)
      .filter((p): p is Pendencia => p !== null);
    const fromTar = summary.tarefasAtrasadas.map(buildTarefaPendencia);
    return [...fromVenc, ...fromTar].sort((a, b) => a.dias - b.dias);
  }, [summary]);

  const filtered = pendencias.filter(
    (p) =>
      (tipoFiltro === "todos" || p.tipo === tipoFiltro) &&
      (sevFiltro === "todos" || p.severidade === sevFiltro),
  );

  if (isLoading || !summary) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />
          Filtros
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Tipo</p>
          <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as PendenciaTipo | "todos")}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="doc_empresa">Doc empresa</SelectItem>
              <SelectItem value="doc_funcionario">Doc funcionário</SelectItem>
              <SelectItem value="integracao">Integração</SelectItem>
              <SelectItem value="tarefa">Tarefa mensal</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Severidade</p>
          <Select
            value={sevFiltro}
            onValueChange={(v) => setSevFiltro(v as PendenciaSeveridade | "todos")}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas</SelectItem>
              <SelectItem value="vencido">Vencido</SelectItem>
              <SelectItem value="vencendo">Vencendo</SelectItem>
              <SelectItem value="atrasada">Atrasada</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="ml-auto text-sm text-muted-foreground">
          {filtered.length} pendência{filtered.length === 1 ? "" : "s"}
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="flex items-center gap-3 p-6">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold">
                  {pendencias.length === 0
                    ? "Nenhuma pendência. Tudo em dia."
                    : "Nenhuma pendência nesse filtro."}
                </p>
                {pendencias.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Ajuste tipo ou severidade para ver outros itens.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-28">Severidade</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead className="w-24">Dias</TableHead>
                  <TableHead>Resolve</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.key}>
                    <TableCell>
                      <Badge className={cn("text-[11px]", SEVERIDADE_BADGE[p.severidade])}>
                        <AlertTriangle className="w-3 h-3 mr-1" />
                        {p.severidade}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.tipoLabel}
                    </TableCell>
                    <TableCell>
                      <p className="text-sm font-medium">{p.item}</p>
                      {p.contexto && (
                        <p className="text-[11px] text-muted-foreground">
                          {p.contexto}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">
                      {format(parseISO(p.vencimento), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <span
                        className={cn(
                          "text-xs font-mono",
                          p.dias < 0 ? "text-red-600" : "text-amber-600",
                        )}
                      >
                        {p.dias < 0 ? `${p.dias}` : `+${p.dias}`}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.responsavel}
                    </TableCell>
                    <TableCell className="text-right">
                      {p.acao.type === "navigate" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => navigate(p.acao.target)}
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          {p.acao.label}
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          disabled={complete.isPending}
                          onClick={async () => {
                            if (p.acao.type !== "complete") return;
                            try {
                              await complete.mutateAsync({
                                id: p.acao.executionId,
                                referenceMonth: p.acao.referenceMonth,
                              });
                              toast.success("Tarefa concluída");
                            } catch (e) {
                              toast.error(
                                e instanceof Error ? e.message : "Erro",
                              );
                            }
                          }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                          {p.acao.label}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
