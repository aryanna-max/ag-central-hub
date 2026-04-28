import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ServiceLineItem from "./ServiceLineItem";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: any[];
  initialClientId?: string;
  initialTitle?: string;
}

interface ServiceItem {
  serviceType: string;
  quantity: string;
  unitValue: string;
}

const defaultService = (): ServiceItem => ({ serviceType: "", quantity: "1", unitValue: "0" });

async function generateCode() {
  const year = new Date().getFullYear();
  const { count } = await supabase
    .from("proposals")
    .select("id", { count: "exact", head: true })
    .like("code", `${year}-P-%`);
  return `${year}-P-${String((count || 0) + 1).padStart(3, "0")}`;
}

export default function NewProposalDrawer({ open, onOpenChange, clients, initialClientId, initialTitle }: Props) {
  const qc = useQueryClient();
  const [code, setCode] = useState("");
  const [clientId, setClientId] = useState(initialClientId || "");
  const [contact, setContact] = useState("");
  const [location, setLocation] = useState("");
  const [title, setTitle] = useState(initialTitle || "");
  const [modality, setModality] = useState("Pontual");
  const [validityDate, setValidityDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 30);
    return date.toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState("");
  const [services, setServices] = useState<ServiceItem[]>([defaultService()]);

  const selectedClient = useMemo(() => clients.find((client) => client.id === clientId), [clients, clientId]);
  const total = useMemo(
    () => services.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitValue) || 0), 0),
    [services],
  );

  useEffect(() => {
    if (!open) return;
    generateCode().then(setCode).catch(() => setCode(""));
    if (initialClientId) setClientId(initialClientId);
    if (initialTitle) setTitle(initialTitle);
  }, [open, initialClientId, initialTitle]);

  useEffect(() => {
    if (!selectedClient) return;
    setContact(selectedClient.contato_engenheiro || selectedClient.contato_financeiro || "");
    setLocation(selectedClient.address || selectedClient.rua || "");
    if (!title) setTitle(`Proposta ${selectedClient.name}`);
  }, [selectedClient, title]);

  const createProposal = useMutation({
    mutationFn: async (status: "rascunho" | "enviada") => {
      const today = new Date();
      const validity = new Date(`${validityDate}T12:00:00`);
      const validityDays = Math.max(1, Math.ceil((validity.getTime() - today.getTime()) / 86400000));
      const serviceSummary = services
        .filter((item) => item.serviceType)
        .map((item) => `${item.serviceType} (${item.quantity} x ${Number(item.unitValue || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })})`)
        .join("; ");

      const scope = [
        contact ? `Contato: ${contact}` : null,
        location ? `Local: ${location}` : null,
        `Modalidade: ${modality}`,
        serviceSummary || null,
        notes || null,
      ].filter(Boolean).join("\n");

      const payload = {
        code,
        client_id: clientId || null,
        title: title || `Proposta ${selectedClient?.name || ""}`.trim(),
        scope: scope || null,
        estimated_value: total,
        final_value: total,
        validity_days: validityDays,
        status,
        service: serviceSummary || null,
        location: location || null,
        sent_at: status === "enviada" ? new Date().toISOString() : null,
      };

      const { error } = await supabase.from("proposals").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proposals-mobile"] });
      qc.invalidateQueries({ queryKey: ["proposals"] });
      toast.success("Proposta salva!");
      onOpenChange(false);
      setClientId(initialClientId || "");
      setContact("");
      setLocation("");
      setTitle(initialTitle || "");
      setModality("Pontual");
      setNotes("");
      setServices([defaultService()]);
    },
    onError: () => toast.error("Erro ao salvar proposta"),
  });

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[92vh]">
        <DrawerHeader>
          <DrawerTitle>Nova Proposta</DrawerTitle>
          <DrawerDescription>Crie um rascunho ou salve e envie diretamente.</DrawerDescription>
        </DrawerHeader>

        <div className="px-4 pb-4 overflow-y-auto space-y-4" data-vaul-no-drag>
          <div>
            <Label>Código</Label>
            <Input value={code} readOnly />
          </div>

          <div>
            <Label>Cliente</Label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar cliente" />
              </SelectTrigger>
              <SelectContent>
                {clients.map((client) => (
                  <SelectItem key={client.id} value={client.id}>{client.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título da proposta" />
          </div>

          <div className="grid grid-cols-1 gap-4">
            <div>
              <Label>Contato</Label>
              <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Contato principal" />
            </div>
            <div>
              <Label>Local / Endereço</Label>
              <Input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Endereço do serviço" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Serviços</Label>
              <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => setServices((current) => [...current, defaultService()])}>
                <Plus className="w-3.5 h-3.5" /> Adicionar
              </Button>
            </div>
            {services.map((item, index) => (
              <ServiceLineItem
                key={index}
                item={item}
                onChange={(next) => setServices((current) => current.map((service, serviceIndex) => serviceIndex === index ? next : service))}
                onRemove={() => setServices((current) => current.filter((_, serviceIndex) => serviceIndex !== index))}
                canRemove={services.length > 1}
              />
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Modalidade</Label>
              <Select value={modality} onValueChange={setModality}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Pontual",
                    "Mensal",
                    "Trimestral",
                    "Semestral",
                    "Anual",
                    "Sob Demanda",
                  ].map((option) => (
                    <SelectItem key={option} value={option}>{option}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Validade</Label>
              <Input type="date" value={validityDate} onChange={(e) => setValidityDate(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Valor Total</Label>
            <div className="rounded-xl border border-border/60 bg-card p-3 text-xl font-bold text-primary">
              {total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
            </div>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Notas adicionais" />
          </div>
        </div>

        <DrawerFooter>
          <Button variant="outline" onClick={() => createProposal.mutate("rascunho")} disabled={!code || !title || createProposal.isPending}>
            Salvar Rascunho
          </Button>
          <Button onClick={() => createProposal.mutate("enviada")} disabled={!code || !title || createProposal.isPending}>
            Salvar e Enviar
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
