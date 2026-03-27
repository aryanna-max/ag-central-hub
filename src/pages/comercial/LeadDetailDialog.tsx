import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Mail, Building2, User, MessageSquare, PhoneCall, Video, MapPin, Send, FileText, DollarSign } from "lucide-react";
import {
  useLeadInteractions, useAddLeadInteraction, useUpdateLead,
  STATUS_LABELS, STATUS_COLORS, ORIGIN_LABELS,
  type Lead, type LeadInteractionType, type LeadStatus,
} from "@/hooks/useLeads";
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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
}

export default function LeadDetailDialog({ open, onOpenChange, lead }: Props) {
  const { data: interactions = [] } = useLeadInteractions(lead?.id);
  const addInteraction = useAddLeadInteraction();
  const updateLead = useUpdateLead();
  const [newContent, setNewContent] = useState("");
  const [newType, setNewType] = useState<LeadInteractionType>("nota");

  if (!lead) return null;

  const handleStatusChange = async (newStatus: string) => {
    const status = newStatus as LeadStatus;
    if (status === lead.status) return;
    try {
      await updateLead.mutateAsync({ id: lead.id, status });
      toast.success(`Status alterado para ${STATUS_LABELS[status]}`);
      onOpenChange(false);
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

  const originLabel = lead.origin ? (ORIGIN_LABELS as any)[lead.origin] || lead.origin : "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{lead.company || lead.name}</span>
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
          {lead.responsible && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <User className="w-4 h-4" /> {lead.responsible}
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
        <ScrollArea className="flex-1 max-h-48">
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
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
