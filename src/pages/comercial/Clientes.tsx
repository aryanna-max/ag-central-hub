import { useState, useMemo } from "react";
import { Building2, Search, Mail, Phone, FileText, DollarSign, FolderOpen, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLeads, useLeadInteractions, type Lead } from "@/hooks/useLeads";
import { useProjects, type Project } from "@/hooks/useProjects";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client {
  name: string;
  company: string | null;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  endereco: string | null;
  leads: Lead[];
  projects: Project[];
  totalValue: number;
}

const STATUS_LABELS: Record<string, string> = {
  planejamento: "Planejamento",
  execucao: "Execução",
  entrega: "Entrega",
  faturamento: "Faturamento",
  concluido: "Concluído",
  pausado: "Pausado",
};

export default function Clientes() {
  const { data: leads = [], isLoading: loadingLeads } = useLeads();
  const { data: projects = [], isLoading: loadingProjects } = useProjects();
  const [search, setSearch] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  // Aggregate clients from converted leads and projects
  const clients = useMemo(() => {
    const map = new Map<string, Client>();

    // Group by company or lead name
    const convertedLeads = leads.filter((l) => l.status === "convertido");

    for (const lead of convertedLeads) {
      const key = (lead.company || lead.name).toLowerCase().trim();
      if (!map.has(key)) {
        map.set(key, {
          name: lead.company || lead.name,
          company: lead.company,
          cnpj: lead.cnpj,
          email: lead.email,
          phone: lead.phone,
          endereco: lead.endereco,
          leads: [],
          projects: [],
          totalValue: 0,
        });
      }
      const client = map.get(key)!;
      client.leads.push(lead);
      if (lead.cnpj && !client.cnpj) client.cnpj = lead.cnpj;
      if (lead.email && !client.email) client.email = lead.email;
      if (lead.phone && !client.phone) client.phone = lead.phone;
      if (lead.endereco && !client.endereco) client.endereco = lead.endereco;
    }

    // Also include projects without a lead match (direct clients)
    for (const project of projects) {
      if (project.client) {
        const key = project.client.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, {
            name: project.client,
            company: project.client,
            cnpj: project.client_cnpj,
            email: null,
            phone: null,
            endereco: null,
            leads: [],
            projects: [],
            totalValue: 0,
          });
        }
        const client = map.get(key)!;
        if (!client.projects.find((p) => p.id === project.id)) {
          client.projects.push(project);
          client.totalValue += project.contract_value || 0;
        }
        if (project.client_cnpj && !client.cnpj) client.cnpj = project.client_cnpj;
      }
    }

    // Link projects to clients via lead_id
    for (const project of projects) {
      if (project.lead_id) {
        for (const [, client] of map) {
          if (client.leads.some((l) => l.id === project.lead_id) && !client.projects.find((p) => p.id === project.id)) {
            client.projects.push(project);
            client.totalValue += project.contract_value || 0;
          }
        }
      }
    }

    return Array.from(map.values()).sort((a, b) => b.totalValue - a.totalValue);
  }, [leads, projects]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.cnpj?.includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const isLoading = loadingLeads || loadingProjects;
  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
        <p className="text-muted-foreground">Base completa de clientes com histórico de interações e projetos</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="w-4 h-4" />Total de Clientes</div>
          <p className="text-2xl font-bold">{clients.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><FolderOpen className="w-4 h-4" />Projetos Vinculados</div>
          <p className="text-2xl font-bold">{clients.reduce((s, c) => s + c.projects.length, 0)}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><DollarSign className="w-4 h-4" />Valor Total</div>
          <p className="text-2xl font-bold">{fmt(clients.reduce((s, c) => s + c.totalValue, 0))}</p>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar clientes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Client cards */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-10">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-10">Nenhum cliente encontrado. Clientes são criados automaticamente ao converter leads.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client, i) => (
            <Card
              key={i}
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedClient(client)}
            >
              <CardContent className="p-4 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold">{client.name}</p>
                    {client.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {client.cnpj}</p>}
                  </div>
                  <Badge variant="secondary" className="text-xs">{client.projects.length} projeto(s)</Badge>
                </div>
                {client.totalValue > 0 && (
                  <p className="text-sm font-medium">{fmt(client.totalValue)}</p>
                )}
                <div className="flex gap-3 text-xs text-muted-foreground">
                  {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>}
                  {client.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</span>}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Client Detail Dialog */}
      <ClientDetailDialog client={selectedClient} open={!!selectedClient} onOpenChange={() => setSelectedClient(null)} />
    </div>
  );
}

function ClientDetailDialog({ client, open, onOpenChange }: { client: Client | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  if (!client) return null;

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {client.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {client.cnpj && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="w-4 h-4" /> CNPJ: <span className="font-medium text-foreground">{client.cnpj}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4" /> {client.phone}
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4" /> {client.email}
            </div>
          )}
          {client.endereco && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="w-4 h-4" /> {client.endereco}
            </div>
          )}
        </div>

        <Separator />

        {/* Projects */}
        <p className="text-sm font-medium">Projetos ({client.projects.length})</p>
        <ScrollArea className="max-h-40">
          {client.projects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">Nenhum projeto vinculado.</p>
          ) : (
            <div className="space-y-2">
              {client.projects.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.service || "Sem serviço"} · {STATUS_LABELS[p.status] || p.status}</p>
                  </div>
                  <div className="text-right">
                    {p.contract_value != null && <p className="font-semibold text-sm">{fmt(p.contract_value)}</p>}
                    {p.start_date && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                        <Calendar className="w-3 h-3" />
                        {format(new Date(p.start_date), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator />

        {/* Leads history */}
        <p className="text-sm font-medium">Leads Vinculados ({client.leads.length})</p>
        <ScrollArea className="max-h-32">
          {client.leads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">Nenhum lead vinculado.</p>
          ) : (
            <div className="space-y-2">
              {client.leads.map((l) => (
                <div key={l.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                  <div>
                    <p className="font-medium">{l.name}</p>
                    <p className="text-xs text-muted-foreground">{l.servico || "Sem serviço"}</p>
                  </div>
                  <div className="text-right">
                    {l.valor != null && <p className="text-sm font-semibold">{fmt(l.valor)}</p>}
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(l.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
