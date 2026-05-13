import { useMemo, useState } from "react";
import { Wrench } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useProjectServicesByStatus } from "@/hooks/useProjectServices";
import { useProjects } from "@/hooks/useProjects";
import { useServiceTypes } from "@/hooks/useServiceTypes";

const SERVICE_STATUSES = [
  { value: "planejamento", label: "Planejamento" },
  { value: "execucao", label: "Execução" },
  { value: "medicao", label: "Medição" },
  { value: "faturamento", label: "Faturamento" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

const STATUS_COLORS: Record<string, string> = {
  planejamento: "bg-slate-200 text-slate-800",
  execucao: "bg-blue-600 text-white",
  medicao: "bg-amber-500 text-white",
  faturamento: "bg-purple-600 text-white",
  concluido: "bg-emerald-600 text-white",
  cancelado: "bg-red-600 text-white",
};

const BILLING_MODES = [
  { value: "fixo_mensal", label: "Fixo Mensal" },
  { value: "diarias", label: "Diárias" },
  { value: "esporadico", label: "Esporádico" },
];

const formatCurrency = (v: number | null) =>
  v == null
    ? "—"
    : `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

export default function ServicosCrossProjectTab() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [billingFilter, setBillingFilter] = useState<string>("all");
  const [projectFilter, setProjectFilter] = useState<string>("all");

  const filter = useMemo(
    () => ({
      status: statusFilter === "all" ? undefined : [statusFilter],
      billingMode: billingFilter === "all" ? undefined : [billingFilter],
      projectId: projectFilter === "all" ? undefined : projectFilter,
    }),
    [statusFilter, billingFilter, projectFilter],
  );

  const { data: rows, isLoading } = useProjectServicesByStatus(filter);
  const { data: projects } = useProjects();
  const { data: types } = useServiceTypes();

  const typeLabelById = useMemo(() => {
    const m = new Map<string, string>();
    (types ?? []).forEach((t) => m.set(t.id, t.label));
    return m;
  }, [types]);

  const totalContractValue = (rows ?? []).reduce(
    (s, r) => s + (r.contract_value ?? 0),
    0,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <Wrench className="w-4 h-4 text-muted-foreground" />

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                {SERVICE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={billingFilter} onValueChange={setBillingFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Modo cobrança" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os modos</SelectItem>
                {BILLING_MODES.map((b) => (
                  <SelectItem key={b.value} value={b.value}>
                    {b.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-72">
                <SelectValue placeholder="Projeto" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os projetos</SelectItem>
                {(projects ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo ? `${p.codigo} — ` : ""}
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="ml-auto text-sm text-muted-foreground">
              {(rows ?? []).length} serviço(s) ·{" "}
              <span className="font-semibold text-foreground">
                {formatCurrency(totalContractValue)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          {isLoading ? (
            <p className="p-12 text-center text-muted-foreground text-sm">
              Carregando serviços...
            </p>
          ) : !rows?.length ? (
            <p className="p-12 text-center text-muted-foreground text-sm">
              Nenhum serviço encontrado para os filtros selecionados.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Projeto</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Modo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>NF</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const typeLabel =
                    (r.service_type_id && typeLabelById.get(r.service_type_id)) ||
                    r.service_type;
                  const billingLabel =
                    BILLING_MODES.find((b) => b.value === r.billing_mode)
                      ?.label ?? r.billing_mode;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm">
                        <div className="font-medium">
                          {r.projects?.codigo ?? "—"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.projects?.name ?? "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{typeLabel}</TableCell>
                      <TableCell className="text-xs">
                        <Badge variant="outline">{billingLabel}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrency(r.contract_value)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={
                            STATUS_COLORS[r.status] ?? "bg-muted text-foreground"
                          }
                        >
                          {SERVICE_STATUSES.find((s) => s.value === r.status)
                            ?.label ?? r.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.start_date
                          ? format(
                              new Date(r.start_date + "T12:00:00"),
                              "dd/MM/yyyy",
                              { locale: ptBR },
                            )
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.nf_number ? (
                          <span>
                            {r.nf_number}
                            {r.nf_date && (
                              <span className="text-muted-foreground ml-1">
                                ·{" "}
                                {format(
                                  new Date(r.nf_date + "T12:00:00"),
                                  "dd/MM",
                                  { locale: ptBR },
                                )}
                              </span>
                            )}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
