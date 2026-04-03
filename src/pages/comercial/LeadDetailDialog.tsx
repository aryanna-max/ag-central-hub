import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, Mail, Building2, User, MessageSquare, PhoneCall, Video, MapPin, Send, FileText, DollarSign, Plus, Check, X } from "lucide-react";
import {
  useLeadInteractions, useAddLeadInteraction, useUpdateLead,
  STATUS_LABELS, STATUS_COLORS, ORIGIN_LABELS,
  type Lead, type LeadInteractionType, type LeadStatus,
} from "@/hooks/useLeads";
import {
  useProposals, useCreateProposal, useUpdateProposal,
  generateNextCode,
  type Proposal,
} from "@/hooks/useProposals";
import { useEmployees } from "@/hooks/useEmployees";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

const INTERACTION_LABELS: Record<LeadInteractionType, { label: string; icon: React.ElementType }> = {
  nota: { label: "Nota", icon: MessageSquare },
  ligacao: { label: "Ligação", icon: PhoneCall },
  email: { label: "E-mail", icon: Mail },
  whatsapp: { label: "WhatsApp", icon: MessageSquare },
  reuniao: { label: "Reunião", icon: Video },
  visita: { label: "Visita", icon: MapPin },
};

const PROPOSAL_STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  aprovada: "Aprovada",
  rejeitada: "Rejeitada",
  convertida: "Convertida",
};

const PROPOSAL_STATUS_COLORS: Record<string, string> = {
  rascunho: "bg-muted text-muted-foreground",
  enviada: "bg-blue-100 text-blue-800",
  aprovada: "bg-green-100 text-green-800",
  rejeitada: "bg-red-100 text-red-800",
  convertida: "bg-purple-100 text-purple-800",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
}

export default function LeadDetailDialog({ open, onOpenChange, lead }: Props) {
  const { data: interactions = [] } = useLeadInteractions(lead?.id);
  const { data: allProposals = [] } = useProposals();
  const { data: employees = [] } = useEmployees();
  const addInteraction = useAddLeadInteraction();
  const updateLead = useUpdateLead();
  const createProposal = useCreateProposal();
  const updateProposal = useUpdateProposal();
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<LeadInteractionType>("nota");
  const [showProposalForm, setShowProposalForm] = useState(false);
  const [proposalForm, setProposalForm] = useState({
    service: "",
    value: "" as string | number,
    field_days: "",
    delivery_days: "",
    empresa_faturadora: "ag_topografia",
    responsible_id: "",
    validity_days: "30",
    notes: "",
  });

  const leadProposals = allProposals.filter((p) => p.lead_id === lead?.id);

  const getEmployeeName = (id: string | null | undefined) => {
    if (!id) return "—";
    return employees.find((e) => e.id === id)?.name || "—";
  };

  if (!lead) return null;

  const handleStatusChange = async (newStatus: string) => {
    const status = newStatus as LeadStatus;
    if (status === lead.status) return;
    try {
      await updateLead.mutateAsync({ id: lead.id, status });
      toast.success(`Status alterado para ${STATUS_LABELS[status]}`);
    } catch {
      toast.error("Erro ao alterar status");
    }
  };

  const handleAddInteraction = async () => {
    if (!newContent.trim()) return;
    try {
      await addInteraction.mutateAsync({
        lead_id: lead.id,
        interaction_type: newType,
        content: newContent.trim(),
        created_by: null,
      });
      setNewContent("");
      toast.success("Interação registrada");
    } catch {
      toast.error("Erro ao registrar interação");
    }
  };

  const handleCreateProposal = async () => {
    if (!proposalForm.service.trim()) {
      toast.error("Descrição do serviço é obrigatória");
      return;
    }
    try {
      const code = await generateNextCode();
      const proposal = await createProposal.mutateAsync({
        code,
        title: proposalForm.service,
        lead_id: lead.id,
        client_id: lead.client_id || null,
        service: proposalForm.service,
        estimated_value: proposalForm.value ? Number(proposalForm.value) : null,
        empresa_faturadora: proposalForm.empresa_faturadora,
        responsible_id: proposalForm.responsible_id || null,
        validity_days: proposalForm.validity_days ? Number(proposalForm.validity_days) : 30,
        technical_notes: proposalForm.notes || null,
        estimated_duration: proposalForm.field_days
          ? `Campo: ${proposalForm.field_days}d, Entrega: ${proposalForm.delivery_days || "—"}d`
          : null,
        status: "enviada",
      });

      // Auto-update lead status to proposta_enviada
      if (lead.status === "novo" || lead.status === "qualificado") {
        await updateLead.mutateAsync({
          id: lead.id,
          status: "proposta_enviada" as any,
        });
      }

      toast.success(`Proposta ${code} criada`);
      setShowProposalForm(false);
      setProposalForm({
        service: "", value: "", field_days: "", delivery_days: "",
        empresa_faturadora: "ag_topografia", responsible_id: "", validity_days: "30", notes: "",
      });
    } catch {
      toast.error("Erro ao criar proposta");
    }
  };

  const handleApproveProposal = async (proposal: Proposal) => {
    try {
      await updateProposal.mutateAsync({
        id: proposal.id,
        status: "aprovada",
        approved_at: new Date().toISOString(),
      });
      // Auto-update lead status to aprovado
      await updateLead.mutateAsync({
        id: lead.id,
        status: "aprovado" as any,
      });
      toast.success("Proposta aprovada — lead movido para Aprovado");
    } catch {
      toast.error("Erro ao aprovar proposta");
    }
  };

  const handleRejectProposal = async (proposal: Proposal) => {
    try {
      await updateProposal.mutateAsync({
        id: proposal.id,
        status: "rejeitada",
        rejected_at: new Date().toISOString(),
      });
      toast.success("Proposta rejeitada");
    } catch {
      toast.error("Erro ao rejeitar proposta");
    }
  };

  const originLabel = lead.origin ? (ORIGIN_LABELS as any)[lead.origin] || lead.origin : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex flex-col">
              {lead.codigo && <span className="text-xs font-mono text-primary">{lead.codigo}</span>}
              <span>{lead.company || lead.name}</span>
            </div>
            <Select value={lead.status} onValueChange={handleStatusChange} disabled={updateLead.isPending}>
              <SelectTrigger className={`w-auto h-6 text-xs border-0 px-2.5 py-0 rounded-full ${STATUS_COLORS[lead.status] || ""}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-4 pr-4">
            {/* Lead info */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              {lead.phone && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="w-4 h-4" /> {lead.phone}
                </div>
              )}
              {lead.email && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Mail className="w-4 h-4" /> {lead.email}
                </div>
              )}
              {lead.company && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="w-4 h-4" /> {lead.company}
                </div>
              )}
              {lead.responsible_id && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <User className="w-4 h-4" /> {getEmployeeName(lead.responsible_id)}
                </div>
              )}
              {lead.cnpj && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <FileText className="w-4 h-4" /> {lead.client_type === "pf" ? "CPF" : "CNPJ"}: <span className="font-medium text-foreground">{lead.cnpj}</span>
                </div>
              )}
              {lead.servico && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Building2 className="w-4 h-4" /> Serviço: <span className="font-medium text-foreground">{lead.servico}</span>
                </div>
              )}
              {(lead.location || lead.endereco) && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="w-4 h-4" /> {lead.location || lead.endereco}
                </div>
              )}
              {lead.valor != null && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <DollarSign className="w-4 h-4" /> R$ {Number(lead.valor).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                </div>
              )}
              <div className="text-muted-foreground">
                Origem: <span className="font-medium text-foreground">{originLabel}</span>
              </div>
              <div className="text-muted-foreground">
                Criado em: <span className="font-medium text-foreground">{format(new Date(lead.created_at), "dd/MM/yyyy", { locale: ptBR })}</span>
              </div>
            </div>

            {lead.notes && <p className="text-sm bg-muted/50 rounded-md p-3">{lead.notes}</p>}

            <Separator />

            {/* ─── PROPOSALS SECTION ─── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Propostas ({leadProposals.length})</p>
                {!showProposalForm && (
                  <Button size="sm" variant="outline" onClick={() => setShowProposalForm(true)}>
                    <Plus className="w-3.5 h-3.5 mr-1" /> Criar proposta
                  </Button>
                )}
              </div>

              {/* Existing proposals */}
              {leadProposals.map((p) => (
                <Card key={p.id}>
                  <CardContent className="p-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono font-bold text-primary">{p.code}</span>
                      <Badge className={`text-xs ${PROPOSAL_STATUS_COLORS[p.status] || ""}`}>
                        {PROPOSAL_STATUS_LABELS[p.status] || p.status}
                      </Badge>
                    </div>
                    <p className="text-sm font-medium">{p.title || p.service}</p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {p.estimated_value != null && (
                        <span>R$ {Number(p.estimated_value).toLocaleString("pt-BR", { minimumFractionDigits: 0 })}</span>
                      )}
                      {p.estimated_duration && <span>{p.estimated_duration}</span>}
                      <span>{p.empresa_faturadora === "ag_cartografia" ? "AG Cartografia" : "AG Topografia"}</span>
                    </div>
                    {p.status === "enviada" && (
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="outline" className="h-7 text-xs text-green-700" onClick={() => handleApproveProposal(p)}>
                          <Check className="w-3 h-3 mr-1" /> Aprovar
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs text-red-700" onClick={() => handleRejectProposal(p)}>
                          <X className="w-3 h-3 mr-1" /> Rejeitar
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}

              {/* Proposal form */}
              {showProposalForm && (
                <Card>
                  <CardContent className="p-3 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Nova Proposta</p>
                    <div className="space-y-2">
                      <Label className="text-xs">Descrição do serviço *</Label>
                      <Input
                        value={proposalForm.service}
                        onChange={(e) => setProposalForm((p) => ({ ...p, service: e.target.value }))}
                        placeholder="Tipo de serviço"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Valor (R$)</Label>
                        <Input
                          type="number"
                          value={proposalForm.value}
                          onChange={(e) => setProposalForm((p) => ({ ...p, value: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Validade (dias)</Label>
                        <Input
                          type="number"
                          value={proposalForm.validity_days}
                          onChange={(e) => setProposalForm((p) => ({ ...p, validity_days: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Dias campo (estimado)</Label>
                        <Input
                          type="number"
                          value={proposalForm.field_days}
                          onChange={(e) => setProposalForm((p) => ({ ...p, field_days: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Dias entrega (estimado)</Label>
                        <Input
                          type="number"
                          value={proposalForm.delivery_days}
                          onChange={(e) => setProposalForm((p) => ({ ...p, delivery_days: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Empresa faturadora</Label>
                        <Select
                          value={proposalForm.empresa_faturadora}
                          onValueChange={(v) => setProposalForm((p) => ({ ...p, empresa_faturadora: v }))}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ag_topografia">AG Topografia</SelectItem>
                            <SelectItem value="ag_cartografia">AG Cartografia</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Responsável</Label>
                        <Select
                          value={proposalForm.responsible_id || "none"}
                          onValueChange={(v) => setProposalForm((p) => ({ ...p, responsible_id: v === "none" ? "" : v }))}
                        >
                          <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Nenhum</SelectItem>
                            {employees.filter((e) => e.status !== "desligado").map((e) => (
                              <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Observações</Label>
                      <Textarea
                        value={proposalForm.notes}
                        onChange={(e) => setProposalForm((p) => ({ ...p, notes: e.target.value }))}
                        rows={2}
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => setShowProposalForm(false)}>Cancelar</Button>
                      <Button size="sm" onClick={handleCreateProposal} disabled={createProposal.isPending}>
                        {createProposal.isPending ? "Salvando..." : "Salvar Proposta"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <Separator />

            {/* Interactions */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Nova Interação</p>
              <div className="flex gap-2">
                <Select value={newType} onValueChange={(v) => setNewType(v as LeadInteractionType)}>
                  <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INTERACTION_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea value={newContent} onChange={(e) => setNewContent(e.target.value)} placeholder="Descreva a interação..." rows={2} className="flex-1" />
                <Button size="icon" onClick={handleAddInteraction} disabled={addInteraction.isPending || !newContent.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <Separator />

            <p className="text-sm font-medium">Histórico ({interactions.length})</p>
            {interactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma interação registrada.</p>
            ) : (
              <div className="space-y-3">
                {interactions.map((i) => {
                  const meta = INTERACTION_LABELS[i.interaction_type];
                  const Icon = meta.icon;
                  return (
                    <div key={i.id} className="flex gap-3 text-sm">
                      <div className="mt-0.5 p-1.5 rounded-md bg-muted">
                        <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{meta.label}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(i.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </span>
                        </div>
                        <p className="text-muted-foreground">{i.content}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
