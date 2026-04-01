import { useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useCreateLead, useUpdateLead,
  ORIGIN_LABELS,
  type Lead, type LeadInsert, type LeadOrigin,
} from "@/hooks/useLeads";
import { useClients } from "@/hooks/useClients";
import { useEmployees } from "@/hooks/useEmployees";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

const RESPONSIBLE_ROLES = ["Diretor", "Diretora Administrativa", "Gerente Operacional"];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead?: Lead | null;
}

export default function LeadFormDialog({ open, onOpenChange, lead }: Props) {
  const createLead = useCreateLead();
  const updateLead = useUpdateLead();
  const { data: clients = [] } = useClients();
  const { data: employees = [] } = useEmployees();
  const isEditing = !!lead;

  const responsaveis = employees.filter((e) =>
    RESPONSIBLE_ROLES.some((r) => e.role?.toLowerCase() === r.toLowerCase())
  );

  const [form, setForm] = useState<LeadInsert>({
    name: "",
    origin: "outro",
    client_type: "pj",
    status: "novo",
  });

  useEffect(() => {
    if (!open) return;
    if (lead) {
      setForm({
        name: lead.name,
        email: lead.email || "",
        phone: lead.phone || "",
        company: lead.company || "",
        origin: (lead.origin as LeadOrigin) || "outro",
        status: lead.status as any,
        responsible_id: lead.responsible_id || null,
        notes: lead.notes || "",
        servico: lead.servico || "",
        location: lead.location || lead.endereco || "",
        valor: lead.valor,
        cnpj: lead.cnpj || "",
        client_id: lead.client_id || null,
        client_type: lead.client_type || "pj",
      });
    } else {
      setForm({
        name: "",
        origin: "outro",
        client_type: "pj",
        status: "novo",
      });
    }
  }, [lead, open]);

  const isExistingClient = form.origin === "cliente_recorrente" || form.origin === "contrato_ativo";

  const selectedClient = clients.find((c) => c.id === form.client_id);

  const handleClientChange = (clientId: string) => {
    const c = clients.find((cl) => cl.id === clientId);
    if (c) {
      setForm((prev) => ({
        ...prev,
        client_id: c.id,
        company: c.name,
        cnpj: c.cnpj || "",
        name: c.name,
        client_type: c.tipo === "pf" ? "pf" : "pj",
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isExistingClient && !form.client_id) {
      toast.error("Selecione um cliente");
      return;
    }
    if (!isExistingClient && !form.name?.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    try {
      const payload = { ...form, endereco: form.location };
      if (isEditing) {
        await updateLead.mutateAsync({ id: lead!.id, ...payload } as any);
        toast.success("Lead atualizado");
      } else {
        await createLead.mutateAsync(payload);
        toast.success("Lead criado");
      }
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar lead");
    }
  };

  const isPending = createLead.isPending || updateLead.isPending;

  const clientLabel = (c: { codigo: string | null; name: string }) =>
    c.codigo ? `${c.codigo} — ${c.name}` : c.name;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar Lead" : "Novo Lead"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Origem */}
          <div className="space-y-2">
            <Label>Origem *</Label>
            <Select
              value={form.origin || "outro"}
              onValueChange={(v) => {
                const newOrigin = v as LeadOrigin;
                setForm((prev) => ({
                  ...prev,
                  origin: newOrigin,
                  client_id: null,
                  company: "",
                  cnpj: "",
                }));
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ORIGIN_LABELS).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Tipo de cliente — only for non-existing client origins */}
          {!isExistingClient && (
            <div className="space-y-2">
              <Label>Tipo de Cliente</Label>
              <Select
                value={form.client_type || "pj"}
                onValueChange={(v) => setForm((prev) => ({ ...prev, client_type: v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pj">Empresa (PJ)</SelectItem>
                  <SelectItem value="pf">Pessoa Física (PF)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Existing client selector */}
          {isExistingClient && (
            <>
              <div className="space-y-2">
                <Label>Cliente *</Label>
                <Select value={form.client_id || ""} onValueChange={handleClientChange}>
                  <SelectTrigger><SelectValue placeholder="Selecione o cliente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{clientLabel(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedClient && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Empresa</Label>
                    <Input value={selectedClient.name} readOnly className="bg-muted" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {selectedClient.tipo === "pf" ? "CPF" : "CNPJ"}
                    </Label>
                    <Input value={selectedClient.cnpj || "—"} readOnly className="bg-muted" />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Non-existing client fields */}
          {!isExistingClient && (
            <div className="grid grid-cols-2 gap-4">
              {form.client_type === "pf" ? (
                <>
                  <div className="col-span-2 space-y-2">
                    <Label>Nome completo *</Label>
                    <Input
                      value={form.name || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Nome completo"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>CPF</Label>
                    <Input
                      value={form.cnpj || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, cnpj: e.target.value }))}
                      placeholder="000.000.000-00"
                    />
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Nome do contato *</Label>
                    <Input
                      value={form.name || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Nome do contato"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <Input
                      value={form.company || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
                      placeholder="Nome da empresa"
                    />
                  </div>
                  <div className="col-span-2 space-y-2">
                    <Label>CNPJ</Label>
                    <Input
                      value={form.cnpj || ""}
                      onChange={(e) => setForm((prev) => ({ ...prev, cnpj: e.target.value }))}
                      placeholder="XX.XXX.XXX/XXXX-XX"
                    />
                  </div>
                </>
              )}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                  placeholder="email@exemplo.com"
                />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={form.phone || ""}
                  onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>
          )}

          {/* Common fields */}
          <div className="space-y-2">
            <Label>Serviço / Descrição</Label>
            <Input
              value={form.servico || ""}
              onChange={(e) => setForm((prev) => ({ ...prev, servico: e.target.value }))}
              placeholder="Tipo de serviço solicitado"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Localização</Label>
              <Input
                value={form.location || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                placeholder="Cidade / Local"
              />
            </div>
            <div className="space-y-2">
              <Label>Valor estimado (R$)</Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={form.valor ?? ""}
                onChange={(e) => setForm((prev) => ({ ...prev, valor: e.target.value ? Number(e.target.value) : null }))}
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Responsável</Label>
            <Select
              value={form.responsible || "none"}
              onValueChange={(v) => setForm((prev) => ({ ...prev, responsible: v === "none" ? null : v }))}
            >
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhum</SelectItem>
                {responsaveis.map((e) => (
                  <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              value={form.notes || ""}
              onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Anotações sobre o lead..."
            />
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
