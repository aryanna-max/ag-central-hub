import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useClients, useCreateClient, useUpdateClient, SEGMENTOS, type Client, type ClientInsert } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
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

function formatCpf(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
}

function extractDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function suggestCode(name: string): string {
  const stopWords = ["de", "do", "da", "dos", "das", "e", "a", "o", "em", "para", "com", "ltda", "sa", "s/a", "me", "epp", "eireli"];
  const cleaned = name
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[&\-_./,;:()]/g, " ")
    .trim();
  const words = cleaned.split(/\s+/).filter(w => w.length > 0 && !stopWords.includes(w.toLowerCase()));
  
  if (words.length === 0) return "";
  
  // If first word is already 3 chars or less (like BRK, 2MS), use it
  if (words[0].length <= 3) return words[0].toUpperCase().slice(0, 3);
  
  // If only one significant word, take first 3 letters
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  
  // Multiple words: try first letter of each
  if (words.length >= 3) {
    return (words[0][0] + words[1][0] + words[2][0]).toUpperCase();
  }
  
  // Two words: first two letters of first + first letter of second
  return (words[0].slice(0, 2) + words[1][0]).toUpperCase();
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client?: Client | null;
}

export default function ClientFormDialog({ open, onOpenChange, client }: Props) {
  const { data: allClients = [] } = useClients();
  const { data: projects = [] } = useProjects();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();
  const isEdit = !!client;

  const [form, setForm] = useState<ClientInsert>({ name: "" });
  const [docDisplay, setDocDisplay] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [fetchingCnpj, setFetchingCnpj] = useState(false);
  const [codigoSuggested, setCodigoSuggested] = useState(false);

  const tipo = form.tipo || "pj";
  const isPF = tipo === "pf";

  const hasProjects = useMemo(() => {
    if (!client) return false;
    return projects.some(p => p.client_id === client.id);
  }, [client, projects]);

  const codigoReadonly = isEdit && hasProjects && !!client?.codigo;

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
        tipo: client.tipo || "pj",
        codigo: client.codigo,
      });
      const isPfEdit = client.tipo === "pf";
      setDocDisplay(client.cnpj ? (isPfEdit ? formatCpf(client.cnpj) : formatCnpj(client.cnpj)) : "");
      setContactName("");
      setContactPhone("");
      setContactEmail("");
      setCodigoSuggested(true);
    } else if (open) {
      setForm({ name: "", tipo: "pj" });
      setDocDisplay("");
      setContactName("");
      setContactPhone("");
      setContactEmail("");
      setCodigoSuggested(false);
    }
  }, [open, client]);

  const fetchCnpj = async (digits: string) => {
    setFetchingCnpj(true);
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const newName = data.razao_social || form.name;
      setForm((prev) => ({
        ...prev,
        name: newName,
        city: data.municipio || prev.city,
        state: data.uf || prev.state,
        address: [data.logradouro, data.numero, data.bairro].filter(Boolean).join(", ") || prev.address,
      }));
      // Auto-suggest code from fetched name
      if (!codigoSuggested && newName) {
        const suggested = suggestCode(newName);
        if (suggested) {
          setForm(prev => ({ ...prev, codigo: suggested }));
          setCodigoSuggested(true);
        }
      }
      toast.success("Dados do CNPJ preenchidos");
    } catch {
      toast.error("CNPJ não encontrado");
    } finally {
      setFetchingCnpj(false);
    }
  };

  const handleDocChange = (value: string) => {
    if (isPF) {
      const formatted = formatCpf(value);
      setDocDisplay(formatted);
      setForm((prev) => ({ ...prev, cnpj: extractDigits(value).slice(0, 11) }));
    } else {
      const formatted = formatCnpj(value);
      setDocDisplay(formatted);
      const digits = extractDigits(value);
      setForm((prev) => ({ ...prev, cnpj: digits.slice(0, 14) }));
      if (digits.length === 14) fetchCnpj(digits);
    }
  };

  const handleTipoChange = (newTipo: string) => {
    setForm(prev => ({ ...prev, tipo: newTipo, cnpj: null }));
    setDocDisplay("");
  };

  const handleNameChange = (name: string) => {
    setForm(prev => ({ ...prev, name }));
    // Auto-suggest código for new clients
    if (!isEdit && !codigoSuggested && name.length >= 3) {
      const suggested = suggestCode(name);
      if (suggested) {
        setForm(prev => ({ ...prev, name, codigo: suggested }));
        setCodigoSuggested(true);
      }
    }
  };

  const handleCodigoChange = (value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 3);
    setForm(prev => ({ ...prev, codigo: upper || null }));
    setCodigoSuggested(true);
  };

  const validateCodigo = (): string | null => {
    const codigo = form.codigo;
    if (!codigo) return null; // not required
    if (codigo.length !== 3) return "Código deve ter exatamente 3 caracteres";
    const existing = allClients.find(c => c.codigo === codigo && c.id !== client?.id);
    if (existing) return `Código já utilizado por "${existing.name}"`;
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error("Nome/Razão Social é obrigatório"); return; }
    
    const codigoError = validateCodigo();
    if (codigoError) { toast.error(codigoError); return; }

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
          {/* Código do cliente */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Código (3 caracteres)</Label>
              <Input
                value={form.codigo || ""}
                onChange={(e) => handleCodigoChange(e.target.value)}
                placeholder="Ex: BRK"
                maxLength={3}
                disabled={codigoReadonly}
                className="uppercase font-mono"
              />
              {codigoReadonly && (
                <p className="text-[10px] text-muted-foreground">Código fixo (cliente com projetos)</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Tipo de cliente</Label>
              <Select value={tipo} onValueChange={handleTipoChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pj">Empresa (PJ)</SelectItem>
                  <SelectItem value="pf">Pessoa Física (PF)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* CNPJ / CPF */}
          <div className="space-y-2">
            <Label>{isPF ? "CPF" : "CNPJ"}</Label>
            <div className="relative">
              <Input
                value={docDisplay}
                onChange={(e) => handleDocChange(e.target.value)}
                placeholder={isPF ? "000.000.000-00" : "00.000.000/0000-00"}
                maxLength={isPF ? 14 : 18}
              />
              {fetchingCnpj && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nome / Razão Social *</Label>
            <Input value={form.name} onChange={(e) => handleNameChange(e.target.value)} />
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
