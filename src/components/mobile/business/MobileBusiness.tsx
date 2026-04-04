import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLeads } from "@/hooks/useLeads";
import { useClients } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import { Search, Briefcase, Users, MessageSquare, CheckCircle2, FileText, DollarSign, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import BusinessKPIs from "./BusinessKPIs";
import LeadFunnel from "./LeadFunnel";
import LeadCard from "./LeadCard";
import ProposalCard from "./ProposalCard";
import ClientCard from "./ClientCard";
import NewProposalDrawer from "./NewProposalDrawer";

const LEAD_SEGMENT_COLORS: Record<string, string> = {
  novo: "#2D6A8E",
  qualificado: "#2F9E8E",
  proposta_enviada: "#E9A825",
  em_contato: "#8AB41D",
  convertido: "#27AE60",
  perdido: "#E74C3C",
  aprovado: "#27AE60",
};

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  expirada: "Expirada",
};

export default function MobileBusiness() {
  const [tab, setTab] = useState("leads");
  const [search, setSearch] = useState("");
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [newProposalOpen, setNewProposalOpen] = useState(false);

  const { data: leads = [] } = useLeads();
  const { data: clients = [] } = useClients();
  const { data: projects = [] } = useProjects();

  const { data: proposals = [] } = useQuery({
    queryKey: ["proposals-mobile"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("*, clients:client_id(name)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const projectCountByClient = useMemo(() => {
    const map = new Map<string, number>();
    projects.forEach((project) => {
      if (!project.client_id) return;
      if (project.status === "concluido" || project.status === "pausado") return;
      map.set(project.client_id, (map.get(project.client_id) || 0) + 1);
    });
    return map;
  }, [projects]);

  const filteredLeads = useMemo(() => {
    const query = search.toLowerCase();
    return leads.filter((lead) => {
      const displayName = lead.company || lead.name;
      return [displayName, lead.servico || "", lead.codigo || "", lead.origin || ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [leads, search]);

  const filteredProposals = useMemo(() => {
    const query = search.toLowerCase();
    return proposals.filter((proposal: any) => {
      const clientName = proposal.clients?.name || "";
      return [proposal.code || "", clientName, proposal.title || "", proposal.service || ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [proposals, search]);

  const filteredClients = useMemo(() => {
    const query = search.toLowerCase();
    return clients.filter((client) =>
      [client.name, client.cnpj || "", client.cidade || client.city || "", client.estado || client.state || ""]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }, [clients, search]);

  const leadSegments = useMemo(
    () => [
      { label: "Novo", count: leads.filter((lead) => lead.status === "novo").length, color: LEAD_SEGMENT_COLORS.novo },
      { label: "Qualificado", count: leads.filter((lead) => lead.status === "qualificado").length, color: LEAD_SEGMENT_COLORS.qualificado },
      { label: "Proposta Enviada", count: leads.filter((lead) => lead.status === "proposta_enviada").length, color: LEAD_SEGMENT_COLORS.proposta_enviada },
      { label: "Em Contato", count: leads.filter((lead) => lead.status === "em_contato").length, color: LEAD_SEGMENT_COLORS.em_contato },
      { label: "Convertido", count: leads.filter((lead) => ["convertido", "aprovado"].includes(lead.status)).length, color: LEAD_SEGMENT_COLORS.convertido },
      { label: "Perdido", count: leads.filter((lead) => lead.status === "perdido").length, color: LEAD_SEGMENT_COLORS.perdido },
    ],
    [leads],
  );

  const proposalPipelineValue = useMemo(
    () => proposals.filter((proposal: any) => ["enviada", "rascunho"].includes(proposal.status)).reduce((sum: number, proposal: any) => sum + Number(proposal.final_value || proposal.estimated_value || 0), 0),
    [proposals],
  );

  return (
    <div className="pb-24">
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-semibold text-primary">Negócios</h1>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9 rounded-xl"
            placeholder="Buscar lead, proposta ou cliente..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <div className="px-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="leads">Leads ({leads.length})</TabsTrigger>
            <TabsTrigger value="propostas">Propostas ({proposals.length})</TabsTrigger>
            <TabsTrigger value="clientes">Clientes ({clients.length})</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="leads" className="space-y-4 mt-0">
          <BusinessKPIs
            items={[
              { label: "Total Leads", value: leads.length, icon: <Users className="w-4 h-4" /> },
              { label: "Qualificados", value: leads.filter((lead) => lead.status === "qualificado").length, icon: <MessageSquare className="w-4 h-4" /> },
              { label: "Convertidos", value: leads.filter((lead) => lead.status === "convertido").length, icon: <CheckCircle2 className="w-4 h-4" /> },
            ]}
          />
          <LeadFunnel segments={leadSegments} />
          <div className="px-4 space-y-3">
            {filteredLeads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                displayName={lead.company || lead.name}
                onClick={() => setSelectedLead(lead)}
              />
            ))}
            {filteredLeads.length === 0 ? <p className="text-sm text-center text-muted-foreground py-10">Nenhum lead encontrado.</p> : null}
          </div>
        </TabsContent>

        <TabsContent value="propostas" className="space-y-4 mt-0">
          <BusinessKPIs
            items={[
              { label: "Total Propostas", value: proposals.length, icon: <FileText className="w-4 h-4" /> },
              { label: "Aprovadas", value: proposals.filter((proposal: any) => proposal.status === "aprovada").length, icon: <CheckCircle2 className="w-4 h-4" /> },
              { label: "Pipeline", value: proposalPipelineValue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }), icon: <DollarSign className="w-4 h-4" /> },
            ]}
          />
          <div className="px-4 space-y-3">
            {filteredProposals.map((proposal: any) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                clientName={proposal.clients?.name || "Cliente não informado"}
                onClick={() => setSelectedProposal(proposal)}
              />
            ))}
            {filteredProposals.length === 0 ? <p className="text-sm text-center text-muted-foreground py-10">Nenhuma proposta encontrada.</p> : null}
          </div>
        </TabsContent>

        <TabsContent value="clientes" className="space-y-4 mt-0">
          <div className="px-4 space-y-3">
            {filteredClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                projectCount={projectCountByClient.get(client.id) || 0}
                onClick={() => setSelectedClient(client)}
              />
            ))}
            {filteredClients.length === 0 ? <p className="text-sm text-center text-muted-foreground py-10">Nenhum cliente encontrado.</p> : null}
          </div>
        </TabsContent>
      </Tabs>

      {tab === "propostas" ? (
        <Button className="fixed bottom-20 right-4 z-40 rounded-full h-14 w-14 shadow-lg" size="icon" onClick={() => setNewProposalOpen(true)}>
          <Plus className="w-5 h-5" />
        </Button>
      ) : null}

      <Sheet open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedLead?.company || selectedLead?.name || "Lead"}</SheetTitle>
            <SheetDescription>Detalhes do lead e estágio atual do funil.</SheetDescription>
          </SheetHeader>
          {selectedLead ? (
            <div className="space-y-4 text-sm">
              <Badge variant="outline">{selectedLead.status}</Badge>
              <div><p className="text-muted-foreground">Origem</p><p className="font-medium">{selectedLead.origin || "—"}</p></div>
              <div><p className="text-muted-foreground">Serviço</p><p className="font-medium">{selectedLead.servico || "—"}</p></div>
              <div><p className="text-muted-foreground">Valor estimado</p><p className="font-medium">{selectedLead.valor ? selectedLead.valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—"}</p></div>
              <div><p className="text-muted-foreground">Observações</p><p className="font-medium whitespace-pre-wrap">{selectedLead.notes || "Sem observações"}</p></div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={!!selectedProposal} onOpenChange={(open) => !open && setSelectedProposal(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedProposal?.code || "Proposta"}</SheetTitle>
            <SheetDescription>Detalhes completos da proposta selecionada.</SheetDescription>
          </SheetHeader>
          {selectedProposal ? (
            <div className="space-y-4 text-sm">
              <Badge variant="outline">{PROPOSAL_STATUS_LABELS[selectedProposal.status] || selectedProposal.status}</Badge>
              <div><p className="text-muted-foreground">Cliente</p><p className="font-medium">{selectedProposal.clients?.name || "—"}</p></div>
              <div><p className="text-muted-foreground">Título</p><p className="font-medium">{selectedProposal.title || "—"}</p></div>
              <div><p className="text-muted-foreground">Valor</p><p className="font-medium">{Number(selectedProposal.final_value || selectedProposal.estimated_value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p></div>
              <div><p className="text-muted-foreground">Escopo</p><p className="font-medium whitespace-pre-wrap">{selectedProposal.scope || selectedProposal.service || "—"}</p></div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <Sheet open={!!selectedClient} onOpenChange={(open) => !open && setSelectedClient(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[85vh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{selectedClient?.name || "Cliente"}</SheetTitle>
            <SheetDescription>Resumo cadastral e quantidade de projetos ativos.</SheetDescription>
          </SheetHeader>
          {selectedClient ? (
            <div className="space-y-4 text-sm">
              <div><p className="text-muted-foreground">Documento</p><p className="font-medium">{selectedClient.cnpj || "—"}</p></div>
              <div><p className="text-muted-foreground">Cidade</p><p className="font-medium">{selectedClient.cidade || selectedClient.city || "—"}{selectedClient.estado || selectedClient.state ? `/${selectedClient.estado || selectedClient.state}` : ""}</p></div>
              <div><p className="text-muted-foreground">Contato</p><p className="font-medium">{selectedClient.phone || selectedClient.email || selectedClient.contato_engenheiro || "—"}</p></div>
              <div><p className="text-muted-foreground">Projetos ativos</p><p className="font-medium">{projectCountByClient.get(selectedClient.id) || 0}</p></div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      <NewProposalDrawer open={newProposalOpen} onOpenChange={setNewProposalOpen} clients={clients} />
    </div>
  );
}
