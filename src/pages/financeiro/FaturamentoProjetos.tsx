import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjectContacts } from "@/hooks/useProjectContacts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import { format, startOfMonth } from "date-fns";

const billingLabels: Record<string, { label: string; color: string }> = {
  medicao_mensal: { label: "Medição Mensal", color: "bg-blue-100 text-blue-800" },
  entrega_nf: { label: "NF na Entrega", color: "bg-emerald-100 text-emerald-800" },
  entrega_recibo: { label: "Recibo na Entrega", color: "bg-amber-100 text-amber-800" },
  misto: { label: "Misto", color: "bg-purple-100 text-purple-800" },
  sem_documento: { label: "Sem Documento", color: "bg-gray-100 text-gray-800" },
};

const execLabels: Record<string, { label: string; color: string }> = {
  aguardando_campo: { label: "Aguardando Campo", color: "bg-gray-100 text-gray-800" },
  em_campo: { label: "Em Campo", color: "bg-blue-100 text-blue-800" },
  campo_concluido: { label: "Campo Concluído", color: "bg-cyan-100 text-cyan-800" },
  aguardando_processamento: { label: "Aguardando Processamento", color: "bg-amber-100 text-amber-800" },
  em_processamento: { label: "Em Processamento", color: "bg-orange-100 text-orange-800" },
  revisao: { label: "Revisão", color: "bg-yellow-100 text-yellow-800" },
  aprovado: { label: "Aprovado", color: "bg-lime-100 text-lime-800" },
  entregue: { label: "Entregue", color: "bg-emerald-100 text-emerald-800" },
  faturamento: { label: "Faturamento", color: "bg-indigo-100 text-indigo-800" },
  pago: { label: "Pago", color: "bg-green-100 text-green-800" },
};

type QuickFilter = "a_faturar" | "medicao_aberta" | "pagos_mes" | "todos";

export default function FaturamentoProjetos() {
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");
  const [filterClient, setFilterClient] = useState("todos");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const { data: expandedContacts = [] } = useProjectContacts(expandedId);

  const { data: projectsRaw = [], isLoading } = useQuery({
    queryKey: ["faturamento-projetos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, codigo, name, billing_type, contract_value, execution_status, delivered_at, empresa_faturadora, cnpj_tomador, instrucao_faturamento_variavel, contato_financeiro, conta_bancaria, referencia_contrato, client_id, is_active, updated_at")
        .eq("is_active", true)
        .order("codigo");
      if (error) throw error;

      const clientIds = [...new Set((data || []).map((p: any) => p.client_id).filter(Boolean))];
      let clientsMap: Record<string, string> = {};
      if (clientIds.length > 0) {
        const { data: clients } = await supabase.from("clients").select("id, name").in("id", clientIds);
        (clients || []).forEach((c: any) => { clientsMap[c.id] = c.name; });
      }

      return (data || []).map((p: any) => ({
        ...p,
        client_name: p.client_id ? clientsMap[p.client_id] || "—" : "—",
      }));
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["faturamento-projetos-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    let list = projectsRaw;
    const now = new Date();
    const monthStart = startOfMonth(now).toISOString();

    if (quickFilter === "a_faturar") {
      list = list.filter((p: any) => p.execution_status === "entregue" && ["entrega_nf", "entrega_recibo"].includes(p.billing_type));
    } else if (quickFilter === "medicao_aberta") {
      list = list.filter((p: any) => p.billing_type === "medicao_mensal" && p.execution_status !== "pago");
    } else if (quickFilter === "pagos_mes") {
      list = list.filter((p: any) => p.execution_status === "pago" && p.updated_at >= monthStart);
    }

    if (filterClient !== "todos") {
      list = list.filter((p: any) => p.client_id === filterClient);
    }

    return list;
  }, [projectsRaw, quickFilter, filterClient]);

  const fmtCurrency = (v: number | null) =>
    v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";

  const filterButtons: { key: QuickFilter; label: string }[] = [
    { key: "todos", label: "Todos" },
    { key: "a_faturar", label: "A faturar" },
    { key: "medicao_aberta", label: "Medição em aberto" },
    { key: "pagos_mes", label: "Pagos este mês" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {filterButtons.map((fb) => (
          <Button
            key={fb.key}
            variant={quickFilter === fb.key ? "default" : "outline"}
            size="sm"
            onClick={() => setQuickFilter(fb.key)}
          >
            {fb.label}
          </Button>
        ))}

        <div className="flex-1" />

        <Select value={filterClient} onValueChange={setFilterClient}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Cliente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os clientes</SelectItem>
            {clients.map((c: any) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">{filtered.length} projeto(s)</p>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8" />
                  <TableHead>Código</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo Fat.</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Entregue em</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Nenhum projeto encontrado</TableCell></TableRow>
                ) : (
                  filtered.map((p: any) => {
                    const billing = p.billing_type ? billingLabels[p.billing_type] : null;
                    const exec = p.execution_status ? execLabels[p.execution_status] : null;
                    const isExpanded = expandedId === p.id;

                    return (
                      <Collapsible key={p.id} asChild open={isExpanded} onOpenChange={() => setExpandedId(isExpanded ? null : p.id)}>
                        <>
                          <CollapsibleTrigger asChild>
                            <TableRow className="cursor-pointer hover:bg-muted/50">
                              <TableCell>
                                <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                              </TableCell>
                              <TableCell className="font-mono font-semibold">{p.codigo || "—"}</TableCell>
                              <TableCell>{p.name}</TableCell>
                              <TableCell>{p.client_name}</TableCell>
                              <TableCell>
                                {billing ? (
                                  <Badge variant="outline" className={`text-[10px] ${billing.color}`}>{billing.label}</Badge>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="text-right">{fmtCurrency(p.contract_value)}</TableCell>
                              <TableCell>
                                {exec ? (
                                  <Badge variant="outline" className={`text-[10px] ${exec.color}`}>{exec.label}</Badge>
                                ) : "—"}
                              </TableCell>
                              <TableCell>
                                {p.delivered_at ? format(new Date(p.delivered_at + "T12:00:00"), "dd/MM/yyyy") : "—"}
                              </TableCell>
                            </TableRow>
                          </CollapsibleTrigger>
                          <CollapsibleContent asChild>
                            <TableRow className="bg-muted/20">
                              <TableCell colSpan={8}>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2 text-sm">
                                  <div>
                                    <span className="text-muted-foreground">Empresa faturadora:</span>{" "}
                                    <span className="font-medium">
                                      {p.empresa_faturadora === "ag_topografia" ? "AG Topografia" : p.empresa_faturadora === "ag_cartografia" ? "AG Cartografia" : p.empresa_faturadora}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">CNPJ tomador:</span>{" "}
                                    <span className="font-medium">{p.cnpj_tomador || "—"}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Instrução variável:</span>{" "}
                                    <span className="font-medium">{p.instrucao_faturamento_variavel ? "Sim" : "Não"}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Contato financeiro:</span>{" "}
                                    <span className="font-medium">
                                      {expandedContacts.find((c) => c.tipo === "financeiro")?.nome || p.contato_financeiro || "—"}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Conta bancária:</span>{" "}
                                    <span className="font-medium">{p.conta_bancaria || "—"}</span>
                                  </div>
                                  <div>
                                    <span className="text-muted-foreground">Ref. contrato:</span>{" "}
                                    <span className="font-medium">{p.referencia_contrato || "—"}</span>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          </CollapsibleContent>
                        </>
                      </Collapsible>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
