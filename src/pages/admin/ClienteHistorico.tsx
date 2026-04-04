import { useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import { useEmployees } from "@/hooks/useEmployees";
import { useLeads } from "@/hooks/useLeads";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Building2, FolderKanban, Briefcase, DollarSign, Users } from "lucide-react";
import { format, parseISO } from "date-fns";
import ColumnToggle, { useColumnVisibility, type ColumnDef } from "@/components/ColumnToggle";

const fmt = (v: number | null) => v != null ? `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";

const statusLabel: Record<string, string> = {
  planejamento: "Planejamento", execucao: "Execução", entrega: "Entrega",
  faturamento: "Faturamento", concluido: "Concluído", pausado: "Pausado",
};
const statusColor: Record<string, string> = {
  planejamento: "bg-blue-100 text-blue-800", execucao: "bg-amber-100 text-amber-800",
  entrega: "bg-purple-100 text-purple-800", faturamento: "bg-orange-100 text-orange-800",
  concluido: "bg-green-100 text-green-800", pausado: "bg-gray-100 text-gray-800",
};
const billingLabel: Record<string, string> = {
  medicao_mensal: "Medição Mensal", entrega_nf: "NF na Entrega",
  entrega_recibo: "Recibo na Entrega", sem_documento: "Sem Documento",
};
const billingColor: Record<string, string> = {
  medicao_mensal: "bg-blue-100 text-blue-800", entrega_nf: "bg-green-100 text-green-800",
  entrega_recibo: "bg-amber-100 text-amber-800", sem_documento: "bg-gray-100 text-gray-800",
};
const leadStatusLabel: Record<string, string> = {
  novo: "Novo", em_contato: "Em contato", qualificado: "Qualificado",
  convertido: "Aprovado", aprovado: "Aprovado", descartado: "Descartado",
  proposta_enviada: "Proposta Enviada", perdido: "Perdido",
};

export default function ClienteHistorico() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { data: clients } = useClients();
  const { data: projects } = useProjects();
  const { data: employees } = useEmployees();
  const { data: leads } = useLeads();
  const [statusFilter, setStatusFilter] = useState<string>("todos");

  const PROJ_COLUMNS: ColumnDef[] = [
    { key: "nome", label: "Nome" },
    { key: "codigo", label: "Código" },
    { key: "servico", label: "Serviço" },
    { key: "status", label: "Status" },
    { key: "valor", label: "Valor" },
    { key: "billing", label: "Tipo Fat." },
    { key: "inicio", label: "Início" },
    { key: "responsavel", label: "Responsável" },
  ];
  const { visibleColumns, toggle: toggleColumn, isVisible } = useColumnVisibility(PROJ_COLUMNS);

  const client = useMemo(() => (clients || []).find(c => c.id === clientId), [clients, clientId]);
  const empMap = useMemo(() => new Map((employees || []).map(e => [e.id, e.name])), [employees]);

  const clientProjects = useMemo(() => {
    if (!projects || !clientId) return [];
    return projects
      .filter(p => p.client_id === clientId)
      .sort((a, b) => (b.start_date || b.created_at).localeCompare(a.start_date || a.created_at));
  }, [projects, clientId]);

  const filtered = useMemo(() => {
    if (statusFilter === "todos") return clientProjects;
    return clientProjects.filter(p => p.status === statusFilter);
  }, [clientProjects, statusFilter]);

  const clientLeads = useMemo(() => {
    if (!leads || !clientId) return [];
    return leads.filter(l => l.client_id === clientId);
  }, [leads, clientId]);

  const stats = useMemo(() => {
    const total = clientProjects.length;
    const emExecucao = clientProjects.filter(p => p.status === "execucao").length;
    const fatPendente = clientProjects.filter(p => p.status === "faturamento").length;
    const valorTotal = clientProjects.reduce((s, p) => s + (p.contract_value || 0), 0);
    return { total, emExecucao, fatPendente, valorTotal };
  }, [clientProjects]);

  const contatos = useMemo(() => {
    const eng = new Set<string>();
    const fin = new Set<string>();
    clientProjects.forEach(p => {
      if (p.contato_engenheiro) eng.add(p.contato_engenheiro);
      if (p.contato_financeiro) fin.add(p.contato_financeiro);
    });
    return { engenheiros: [...eng], financeiros: [...fin] };
  }, [clientProjects]);

  if (!client) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Cliente não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/clientes")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const location = [client.cidade || client.city, client.estado || client.state].filter(Boolean).join("/");

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate("/admin/clientes")}>
          <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" />
            {client.name}
          </h1>
          <div className="flex flex-wrap gap-2 mt-1 text-sm text-muted-foreground">
            {client.cnpj && <span>{client.cnpj}</span>}
            {location && <span>• {location}</span>}
            {client.segmento && <span>• {client.segmento}</span>}
          </div>
        </div>
        <Badge variant="outline" className="text-sm">{stats.total} projetos</Badge>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total de Projetos", value: stats.total, icon: FolderKanban },
          { label: "Em Execução", value: stats.emExecucao, icon: Briefcase },
          { label: "Fat. Pendente", value: stats.fatPendente, icon: DollarSign },
          { label: "Valor Total", value: fmt(stats.valorTotal), icon: DollarSign },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <k.icon className="w-8 h-8 text-primary/60" />
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-lg font-bold">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Projetos */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Projetos</h2>
          <div className="flex items-center gap-2">
            <ColumnToggle columns={PROJ_COLUMNS} visibleColumns={visibleColumns} onToggle={toggleColumn} />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-9"><SelectValue placeholder="Filtrar status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(statusLabel).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="rounded-md border overflow-x-auto scrollbar-thin">
          <Table>
            <TableHeader>
              <TableRow>
                {isVisible("nome") && <TableHead>Nome</TableHead>}
                {isVisible("codigo") && <TableHead>Código</TableHead>}
                {isVisible("servico") && <TableHead>Serviço</TableHead>}
                {isVisible("status") && <TableHead>Status</TableHead>}
                {isVisible("valor") && <TableHead className="text-right">Valor</TableHead>}
                {isVisible("billing") && <TableHead>Tipo Fat.</TableHead>}
                {isVisible("inicio") && <TableHead>Início</TableHead>}
                {isVisible("responsavel") && <TableHead>Responsável</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhum projeto encontrado.</TableCell></TableRow>
              ) : filtered.map(p => (
                <TableRow key={p.id}>
                  {isVisible("nome") && <TableCell className="font-medium">{p.name}</TableCell>}
                  {isVisible("codigo") && <TableCell className="font-mono text-xs">{p.codigo || "—"}</TableCell>}
                  {isVisible("servico") && <TableCell className="text-sm">{p.service || "—"}</TableCell>}
                  {isVisible("status") && <TableCell><Badge className={statusColor[p.status] || ""}>{statusLabel[p.status] || p.status}</Badge></TableCell>}
                  {isVisible("valor") && <TableCell className="text-right">{fmt(p.contract_value)}</TableCell>}
                  {isVisible("billing") && <TableCell>
                    {p.billing_type ? (
                      <Badge className={billingColor[p.billing_type] || "bg-gray-100 text-gray-800"}>{billingLabel[p.billing_type] || p.billing_type}</Badge>
                    ) : "—"}
                  </TableCell>}
                  {isVisible("inicio") && <TableCell className="text-sm">{p.start_date ? format(parseISO(p.start_date), "dd/MM/yyyy") : "—"}</TableCell>}
                  {isVisible("responsavel") && <TableCell className="text-sm">{p.responsible_id ? empMap.get(p.responsible_id) || "—" : "—"}</TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Contatos */}
      {(contatos.engenheiros.length > 0 || contatos.financeiros.length > 0 || client.notes) && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold flex items-center gap-2"><Users className="w-4 h-4" /> Contatos e Observações</h3>
            {contatos.engenheiros.length > 0 && (
              <div><span className="text-sm font-medium">Engenheiros: </span><span className="text-sm">{contatos.engenheiros.join(", ")}</span></div>
            )}
            {contatos.financeiros.length > 0 && (
              <div><span className="text-sm font-medium">Financeiros: </span><span className="text-sm">{contatos.financeiros.join(", ")}</span></div>
            )}
            {client.notes && <div><span className="text-sm font-medium">Observações: </span><span className="text-sm">{client.notes}</span></div>}
          </CardContent>
        </Card>
      )}

      {/* Leads */}
      {clientLeads.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <h3 className="font-semibold">Leads vinculados</h3>
            <div className="space-y-2">
              {clientLeads.map(l => (
                <div key={l.id} className="flex items-center gap-3 text-sm">
                  <span className="font-medium">{l.name}</span>
                  <Badge variant="outline">{leadStatusLabel[l.status] || l.status}</Badge>
                  <span className="text-muted-foreground">{format(parseISO(l.created_at), "dd/MM/yyyy")}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
