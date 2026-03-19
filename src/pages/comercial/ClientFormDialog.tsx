import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useCreateClient, useUpdateClient, SEGMENTOS, type Client, type ClientInsert } from "@/hooks/useClients";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

function formatCnpj(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  if (digits.length <= 8) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  if (digits.length <= 12) return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function extractDigits(value: string): string {
  return value.replace(/\D/g, "");
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
}

export default function ClientFormDialog({ open, onOpenChange, client }: Props) {
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const isEdit = !!client;

  const [form, setForm] = useState<ClientInsert>({ name: "" });
  const [cnpjDisplay, setCnpjDisplay] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [fetchingCnpj, setFetchingCnpj] = useState(false);

  useEffect(() => {
    if (open && client) {
      setForm({
        name: client.name,
        cnpj: client.cnpj,
        email: client.email,
        phone: client.phone,
        address: client.address,
        city: client.city,
        state: client.state,
        segmento: client.segmento,
        notes: client.notes,
      });
      setCnpjDisplay(client.cnpj ? formatCnpj(client.cnpj) : "");
      // Contact fields are separate from client in edit mode
      setContactName("");
      setContactPhone("");
      setContactEmail("");
    } else if (open) {
      setForm({ name: "" });
      setCnpjDisplay("");
      setContactName("");
      setContactPhone("");
      setContactEmail("");
    }
  }, [open, client]);

  const fetchCnpj = async (digits: string) => {
    setFetchingCnpj(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setForm((prev) => ({
        ...prev,
        name: data.razao_social || prev.name,
        city: data.municipio || prev.city,
        state: data.uf || prev.state,
        address: [data.logradouro, data.numero, data.bairro].filter(Boolean).join(", ") || prev.address,
      }));
      toast.success("Dados do CNPJ preenchidos");
    } catch {
      toast.error("CNPJ não encontrado");
    } finally {
      setFetchingCnpj(false);
    }
  };

  const handleCnpjChange = (value: string) => {
    const formatted = formatCnpj(value);
    setCnpjDisplay(formatted);
    const digits = extractDigits(value);
    setForm((prev) => ({ ...prev, cnpj: digits }));
    if (digits.length === 14) fetchCnpj(digits);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nome/Razão Social é obrigatório"); return; }
    try {
      if (isEdit) {
        await updateClient.mutateAsync({ id: client.id, ...form });
        toast.success("Cliente atualizado");
      } else {
        await createClient.mutateAsync(form);
        toast.success("Cliente cadastrado");
      }
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar cliente");
    }
  };

  const pending = createClient.isPending || updateClient.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* CNPJ with BrasilAPI */}
          <div className="space-y-2">
            <Label>CNPJ</Label>
            <div className="relative">
              <Input
                value={cnpjDisplay}
                onChange={(e) => handleCnpjChange(e.target.value)}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
              {fetchingCnpj && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nome / Razão Social *</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>

          <Separator />
          <p className="text-sm font-medium text-muted-foreground">Contato Principal</p>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">Nome</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Telefone</Label>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">E-mail</Label>
              <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="h-9" />
            </div>
          </div>

          <Separator />

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cidade</Label>
              <Input value={form.city || ""} onChange={(e) => setForm({ ...form, city: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>UF</Label>
              <Input value={form.state || ""} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Endereço</Label>
            <Input value={form.address || ""} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Segmento</Label>
            <Select value={form.segmento || "none"} onValueChange={(v) => setForm({ ...form, segmento: v === "none" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Selecione</SelectItem>
                {SEGMENTOS.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
