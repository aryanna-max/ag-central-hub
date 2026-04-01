import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Save } from "lucide-react";
import { useCreateProposal, useUpdateProposal, useSaveProposalItems, generateNextCode, Proposal } from "@/hooks/useProposals";
import { useClients } from "@/hooks/useClients";
import { SERVICOS } from "@/hooks/useOpportunities";
import { toast } from "sonner";

interface ProposalItemRow {
  description: string;
  unit: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  sort_order: number;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal?: Proposal | null;
  prefill?: Partial<Proposal> & { items?: ProposalItemRow[] };
}

const RESPONSAVEIS = ["Aryanna", "Sérgio", "Ciro"];

export default function PropostaFormDialog({ open, onOpenChange, proposal, prefill }: Props) {
  const create = useCreateProposal();
  const update = useUpdateProposal();
  const saveItems = useSaveProposalItems();
  const { data: clients } = useClients();

  const [form, setForm] = useState({
    code: "",
    title: "",
    client_name: "",
    client_id: "",
    service: "",
    empresa_faturadora: "ag_topografia",
    scope: "",
    location: "",
    estimated_value: 0,
    discount_pct: 0,
    final_value: 0,
    validity_days: 30,
    estimated_duration: "",
    payment_conditions: "",
    technical_notes: "",
    responsible: "",
  });

  const [items, setItems] = useState<ProposalItemRow[]>([
    { description: "", unit: "un", quantity: 1, unit_price: 0, total_price: 0, sort_order: 0 },
  ]);

  useEffect(() => {
    if (proposal) {
      setForm({
        code: proposal.code,
        title: proposal.title,
        client_id: proposal.client_id || "",
        client_id: proposal.client_id || "",
        service: proposal.service || "",
        empresa_faturadora: proposal.empresa_faturadora,
        scope: proposal.scope || "",
        location: proposal.location || "",
        estimated_value: proposal.estimated_value || 0,
        discount_pct: proposal.discount_pct || 0,
        final_value: proposal.final_value || 0,
        validity_days: proposal.validity_days || 30,
        estimated_duration: proposal.estimated_duration || "",
        payment_conditions: proposal.payment_conditions || "",
        technical_notes: proposal.technical_notes || "",
        responsible_id: proposal.responsible_id || "",
      });
    } else if (prefill) {
      generateNextCode().then((code) => {
        setForm((prev) => ({
          ...prev,
          code,
          title: prefill.title || "",
          client_name: prefill.client_name || "",
          service: prefill.service || "",
          empresa_faturadora: prefill.empresa_faturadora || "ag_topografia",
          scope: prefill.scope || "",
          location: prefill.location || "",
          estimated_value: prefill.estimated_value || 0,
          final_value: prefill.final_value || 0,
          estimated_duration: prefill.estimated_duration || "",
          payment_conditions: prefill.payment_conditions || "",
          technical_notes: prefill.technical_notes || "",
          responsible: prefill.responsible || "",
        }));
        if (prefill.items && prefill.items.length > 0) {
          setItems(prefill.items);
        }
      });
    } else {
      generateNextCode().then((code) => {
        setForm((prev) => ({ ...prev, code }));
      });
    }
  }, [proposal, prefill, open]);

  const addItem = () => {
    setItems([...items, { description: "", unit: "un", quantity: 1, unit_price: 0, total_price: 0, sort_order: items.length }]);
  };

  const removeItem = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, field: keyof ProposalItemRow, value: string | number) => {
    const updated = [...items];
    (updated[idx] as any)[field] = value;
    if (field === "quantity" || field === "unit_price") {
      updated[idx].total_price = Number(updated[idx].quantity) * Number(updated[idx].unit_price);
    }
    setItems(updated);

    const total = updated.reduce((s, i) => s + (i.total_price || 0), 0);
    const discount = form.discount_pct || 0;
    setForm((prev) => ({
      ...prev,
      estimated_value: total,
      final_value: total * (1 - discount / 100),
    }));
  };

  const handleSave = async () => {
    if (!form.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }

    try {
      const payload = {
        ...form,
        client_id: form.client_id || null,
        estimated_value: form.estimated_value || 0,
        final_value: form.final_value || form.estimated_value || 0,
      };

      let savedId: string;
      if (proposal) {
        await update.mutateAsync({ id: proposal.id, ...payload });
        savedId = proposal.id;
      } else {
        const result = await create.mutateAsync(payload as any);
        savedId = result.id;
      }

      const validItems = items.filter((i) => i.description.trim());
      if (validItems.length > 0) {
        await saveItems.mutateAsync({
          proposalId: savedId,
          items: validItems.map((i, idx) => ({ ...i, proposal_id: savedId, sort_order: idx })),
        });
      }

      toast.success(`Proposta ${form.code} salva com sucesso`);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar proposta");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{proposal ? "Editar Proposta" : "Nova Proposta"} — {form.code}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="col-span-2">
            <Label>Título</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Ex: Levantamento Topográfico — Fazenda São João" />
          </div>

          <div>
            <Label>Cliente</Label>
            <Select value={form.client_id} onValueChange={(v) => {
              const client = clients?.find((c) => c.id === v);
              setForm({ ...form, client_id: v, client_name: client?.name || "" });
            }}>
              <SelectTrigger><SelectValue placeholder="Selecionar cliente" /></SelectTrigger>
              <SelectContent>
                {clients?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Nome do Cliente (avulso)</Label>
            <Input value={form.client_name} onChange={(e) => setForm({ ...form, client_name: e.target.value })} placeholder="Se não houver cadastro" />
          </div>

          <div>
            <Label>Serviço</Label>
            <Select value={form.service} onValueChange={(v) => setForm({ ...form, service: v })}>
              <SelectTrigger><SelectValue placeholder="Tipo de serviço" /></SelectTrigger>
              <SelectContent>
                {SERVICOS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Empresa Faturadora</Label>
            <Select value={form.empresa_faturadora} onValueChange={(v) => setForm({ ...form, empresa_faturadora: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ag_topografia">AG Topografia</SelectItem>
                <SelectItem value="ag_cartografia">AG Cartografia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Responsável</Label>
            <Select value={form.responsible} onValueChange={(v) => setForm({ ...form, responsible: v })}>
              <SelectTrigger><SelectValue placeholder="Responsável" /></SelectTrigger>
              <SelectContent>
                {RESPONSAVEIS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Local</Label>
            <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Endereço ou local da obra" />
          </div>

          <div className="col-span-2">
            <Label>Escopo</Label>
            <Textarea rows={3} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} placeholder="Descrição detalhada do escopo do serviço" />
          </div>

          {/* Items */}
          <div className="col-span-2">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-base font-semibold">Itens da Proposta</Label>
              <Button type="button" size="sm" variant="outline" onClick={addItem}>
                <Plus className="w-4 h-4 mr-1" /> Adicionar Item
              </Button>
            </div>
            <div className="space-y-2">
              {items.map((item, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end bg-muted/50 p-2 rounded-lg">
                  <div className="col-span-4">
                    {idx === 0 && <Label className="text-xs">Descrição</Label>}
                    <Input value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} placeholder="Descrição" />
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <Label className="text-xs">Unidade</Label>}
                    <Select value={item.unit} onValueChange={(v) => updateItem(idx, "unit", v)}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["un", "m²", "km", "ha", "mês", "dia", "vb"].map((u) => (
                          <SelectItem key={u} value={u}>{u}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <Label className="text-xs">Qtd</Label>}
                    <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-2">
                    {idx === 0 && <Label className="text-xs">Valor Un.</Label>}
                    <Input type="number" value={item.unit_price} onChange={(e) => updateItem(idx, "unit_price", parseFloat(e.target.value) || 0)} />
                  </div>
                  <div className="col-span-1 text-right font-mono text-sm pt-1">
                    {idx === 0 && <Label className="text-xs">Total</Label>}
                    <p className="h-10 flex items-center justify-end">
                      {item.total_price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </p>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeItem(idx)} disabled={items.length <= 1}>
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <Label>Valor Total</Label>
            <Input type="number" value={form.estimated_value} onChange={(e) => {
              const v = parseFloat(e.target.value) || 0;
              setForm({ ...form, estimated_value: v, final_value: v * (1 - (form.discount_pct || 0) / 100) });
            }} />
          </div>

          <div>
            <Label>Desconto (%)</Label>
            <Input type="number" value={form.discount_pct} onChange={(e) => {
              const d = parseFloat(e.target.value) || 0;
              setForm({ ...form, discount_pct: d, final_value: (form.estimated_value || 0) * (1 - d / 100) });
            }} />
          </div>

          <div>
            <Label>Valor Final</Label>
            <Input type="number" value={form.final_value} readOnly className="bg-muted" />
          </div>

          <div>
            <Label>Prazo Estimado</Label>
            <Input value={form.estimated_duration} onChange={(e) => setForm({ ...form, estimated_duration: e.target.value })} placeholder="Ex: 15 dias úteis" />
          </div>

          <div>
            <Label>Validade (dias)</Label>
            <Input type="number" value={form.validity_days} onChange={(e) => setForm({ ...form, validity_days: parseInt(e.target.value) || 30 })} />
          </div>

          <div>
            <Label>Condições de Pagamento</Label>
            <Input value={form.payment_conditions} onChange={(e) => setForm({ ...form, payment_conditions: e.target.value })} placeholder="Ex: 50% contratação + 50% entrega" />
          </div>

          <div className="col-span-2">
            <Label>Observações Técnicas</Label>
            <Textarea rows={2} value={form.technical_notes} onChange={(e) => setForm({ ...form, technical_notes: e.target.value })} />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave} disabled={create.isPending || update.isPending}>
            <Save className="w-4 h-4 mr-1" />
            {proposal ? "Atualizar" : "Salvar Proposta"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
