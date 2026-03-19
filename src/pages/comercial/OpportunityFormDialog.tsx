import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateOpportunity, useUpdateOpportunity, STAGE_LABELS, PIPELINE_STAGES, type Opportunity, type OpportunityInsert } from "@/hooks/useOpportunities";
import { useLeads } from "@/hooks/useLeads";
import { useClients } from "@/hooks/useClients";
import { toast } from "sonner";

const RESPONSAVEIS = ["Aryanna", "Sérgio", "Ciro"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  opportunity?: Opportunity | null;
}

export default function OpportunityFormDialog({ open, onOpenChange, opportunity }: Props) {
  const createOpp = useCreateOpportunity();
  const updateOpp = useUpdateOpportunity();
  const { data: leads = [] } = useLeads();
  const { data: clients = [] } = useClients();
  const isEdit = !!opportunity;

  const [form, setForm] = useState<OpportunityInsert>({
    name: "",
    stage: "prospeccao",
  });

  useEffect(() => {
    if (open && opportunity) {
      setForm({
        name: opportunity.name,
        lead_id: opportunity.lead_id,
        client: opportunity.client,
        client_id: opportunity.client_id,
        value: opportunity.value,
        stage: opportunity.stage,
        responsible: opportunity.responsible,
        expected_close_date: opportunity.expected_close_date,
        notes: opportunity.notes,
      });
    } else if (open) {
      setForm({ name: "", stage: "prospeccao" });
    }
  }, [open, opportunity]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    try {
      if (isEdit) {
        await updateOpp.mutateAsync({ id: opportunity.id, ...form });
        toast.success("Oportunidade atualizada");
      } else {
        await createOpp.mutateAsync(form);
        toast.success("Oportunidade criada");
      }
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar oportunidade");
    }
  };

  const pending = createOpp.isPending || updateOpp.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Oportunidade" : "Nova Oportunidade"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Lead vinculado</Label>
              <Select value={form.lead_id || "none"} onValueChange={(v) => setForm({ ...form, lead_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {leads.map((l) => (
                    <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Etapa</Label>
              <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PIPELINE_STAGES.map((s) => (
                    <SelectItem key={s} value={s}>{STAGE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente vinculado</Label>
              <Select value={form.client_id || "none"} onValueChange={(v) => setForm({ ...form, client_id: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cliente</Label>
              <Input value={form.client || ""} onChange={(e) => setForm({ ...form, client: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" step="0.01" value={form.value ?? ""} onChange={(e) => setForm({ ...form, value: e.target.value ? Number(e.target.value) : null })} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Responsável</Label>
              <Select value={form.responsible || "none"} onValueChange={(v) => setForm({ ...form, responsible: v === "none" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nenhum</SelectItem>
                  {RESPONSAVEIS.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Previsão de fechamento</Label>
              <Input type="date" value={form.expected_close_date || ""} onChange={(e) => setForm({ ...form, expected_close_date: e.target.value || null })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{pending ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
