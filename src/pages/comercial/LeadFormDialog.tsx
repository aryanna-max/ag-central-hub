import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateLead, useUpdateLead, type Lead, type LeadInsert, type LeadSource, type LeadStatus } from "@/hooks/useLeads";
import { useLeadConversion } from "@/hooks/useLeadConversion";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const SOURCE_LABELS: Record<LeadSource, string> = {
  whatsapp: "WhatsApp",
  telefone: "Telefone",
  email: "E-mail",
  site: "Site",
  indicacao: "Indicação",
  rede_social: "Rede Social",
  licitacao: "Licitação",
  outros: "Outros",
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  novo: "Novo",
  em_contato: "Em Contato",
  qualificado: "Qualificado",
  convertido: "Convertido",
  descartado: "Descartado",
};

const RESPONSAVEIS = ["Aryanna", "Sérgio", "Ciro"];

const SERVICOS = [
  "Levantamento Planimétrico",
  "Levantamento Altimétrico",
  "Levantamento Planialtimétrico",
  "Levantamento Cadastral Urbano",
  "Levantamento Cadastral Rural",
  "Levantamento para Projeto de Engenharia",
  "Levantamento Batimétrico",
  "Levantamento com Drone/VANT",
  "Escaneamento Laser 3D",
  "Georreferenciamento INCRA",
  "Desmembramento de Área",
  "Remembramento de Área",
  "Usucapião",
  "Retificação em Cartório",
  "Locação de Obra",
  "Controle de Terraplenagem",
  "As-built",
  "Acompanhamento de Obras",
  "Topografia Industrial",
  "Supervisão Técnica",
  "Projeto de Loteamento",
];

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function extractCnpjDigits(value: string): string {
  return value.replace(/\D/g, "");
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
}

export default function LeadFormDialog({ open, onOpenChange, lead }: Props) {
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const { convertLead, isPending: conversionPending } = useLeadConversion();
  const isEditing = !!lead;

  const [form, setForm] = useState<LeadInsert>({
    name: "",
    email: "",
    phone: "",
    company: "",
    source: "outros",
    status: "novo",
    responsible: "",
    notes: "",
    servico: "",
    endereco: "",
    valor: null,
    cnpj: "",
  });

  const [cnpjDisplay, setCnpjDisplay] = useState("");
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState("");

  useEffect(() => {
    if (lead) {
      setForm({
        name: lead.name,
        email: lead.email || "",
        phone: lead.phone || "",
        company: lead.company || "",
        source: lead.source,
        status: lead.status,
        responsible: lead.responsible || "",
        notes: lead.notes || "",
        servico: lead.servico || "",
        endereco: lead.endereco || "",
        valor: lead.valor,
        cnpj: lead.cnpj || "",
      });
      setCnpjDisplay(lead.cnpj ? formatCnpj(lead.cnpj) : "");
    } else {
      setForm({ name: "", email: "", phone: "", company: "", source: "outros", status: "novo", responsible: "", notes: "", servico: "", endereco: "", valor: null, cnpj: "" });
      setCnpjDisplay("");
    }
    setCnpjError("");
  }, [lead, open]);

  const fetchCnpj = useCallback(async (digits: string) => {
    setCnpjLoading(true);
    setCnpjError("");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error("not found");
      const data = await res.json();
      setForm((prev) => ({
        ...prev,
        company: data.razao_social || prev.company,
        endereco: data.municipio && data.uf ? `${data.municipio} - ${data.uf}` : prev.endereco,
      }));
    } catch {
      setCnpjError("CNPJ não encontrado");
    } finally {
      setCnpjLoading(false);
    }
  }, []);

  const handleCnpjChange = (value: string) => {
    const formatted = formatCnpj(value);
    setCnpjDisplay(formatted);
    const digits = extractCnpjDigits(value);
    setForm((prev) => ({ ...prev, cnpj: digits }));
    setCnpjError("");
    if (digits.length === 14) {
      fetchCnpj(digits);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    try {
      if (isEditing) {
        const updated = await updateLead.mutateAsync({ id: lead.id, ...form });
        // If status changed to 'convertido', auto-create project + alerts
        const wasConverted = lead.status !== "convertido" && form.status === "convertido";
        if (wasConverted) {
          const fullLead = { ...lead, ...form, id: lead.id } as Lead;
          await convertLead(fullLead);
          toast.success("Lead convertido — projeto criado e alertas enviados");
        } else {
          toast.success("Lead atualizado");
        }
      } else {
        await createLead.mutateAsync(form);
        toast.success("Lead criado");
      }
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar lead");
    }
  };

  const isPending = createLead.isPending || updateLead.isPending || conversionPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Lead" : "Novo Lead"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nome do contato" />
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={form.phone || ""} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="(00) 00000-0000" />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@exemplo.com" />
            </div>
            <div className="col-span-2">
              <Label>CNPJ</Label>
              <div className="relative">
                <Input
                  value={cnpjDisplay}
                  onChange={(e) => handleCnpjChange(e.target.value)}
                  placeholder="XX.XXX.XXX/XXXX-XX"
                  maxLength={18}
                />
                {cnpjLoading && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
              {cnpjError && <p className="text-xs text-destructive mt-1">{cnpjError}</p>}
            </div>
            <div>
              <Label>Cliente / Empresa</Label>
              <Input value={form.company || ""} onChange={(e) => setForm({ ...form, company: e.target.value })} placeholder="Nome da empresa" />
            </div>
            <div>
              <Label>Responsável</Label>
              <Select value={form.responsible || ""} onValueChange={(v) => setForm({ ...form, responsible: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {RESPONSAVEIS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Origem</Label>
              <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as LeadSource })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Serviço</Label>
              <Select value={form.servico || ""} onValueChange={(v) => setForm({ ...form, servico: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                <SelectContent>
                  {SERVICOS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Endereço</Label>
              <Input value={form.endereco || ""} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Endereço do serviço" />
            </div>
            <div>
              <Label>Valor (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.valor ?? ""}
                onChange={(e) => setForm({ ...form, valor: e.target.value ? Number(e.target.value) : null })}
                placeholder="0,00"
              />
            </div>
            <div className="col-span-2">
              <Label>Observações</Label>
              <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} placeholder="Anotações sobre o lead..." />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={isPending}>{isPending ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
