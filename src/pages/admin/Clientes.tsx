import { useState, useMemo } from "react";
import { Building2, Search, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useClients, useCreateClient, useUpdateClient, type Client } from "@/hooks/useClients";
import { toast } from "sonner";

const TIPOS = ["Construtora", "Incorporadora", "Empresa privada", "Órgão público", "Pessoa física"] as const;

export default function AdminClientes() {
  const { data: clients = [], isLoading } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);

  const [form, setForm] = useState({
    name: "", cnpj: "", tipo: "", contato_engenheiro: "", contato_financeiro: "", notes: "",
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.cnpj?.toLowerCase().includes(q));
  }, [clients, search]);

  const openNew = () => {
    setEditClient(null);
    setForm({ name: "", cnpj: "", tipo: "", contato_engenheiro: "", contato_financeiro: "", notes: "" });
    setFormOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditClient(c);
    setForm({
      name: c.name,
      cnpj: c.cnpj || "",
      tipo: (c as any).tipo || "",
      contato_engenheiro: (c as any).contato_engenheiro || "",
      contato_financeiro: (c as any).contato_financeiro || "",
      notes: c.notes || "",
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    try {
      if (editClient) {
        await updateClient.mutateAsync({
          id: editClient.id,
          name: form.name,
          cnpj: form.cnpj || null,
          notes: form.notes || null,
          ...({ tipo: form.tipo || null, contato_engenheiro: form.contato_engenheiro || null, contato_financeiro: form.contato_financeiro || null } as any),
        } as any);
        toast.success("Cliente atualizado!");
      } else {
        await createClient.mutateAsync({
          name: form.name,
          cnpj: form.cnpj || null,
          notes: form.notes || null,
          ...({ tipo: form.tipo || null, contato_engenheiro: form.contato_engenheiro || null, contato_financeiro: form.contato_financeiro || null } as any),
        } as any);
        toast.success("Cliente cadastrado!");
      }
      setFormOpen(false);
    } catch {
      toast.error("Erro ao salvar cliente");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="w-6 h-6 text-primary" /> Clientes
          </h1>
          <p className="text-muted-foreground text-sm">Cadastro e gestão de clientes</p>
        </div>
        <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo Cliente</Button>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum cliente encontrado.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CNPJ</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-20" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow key={c.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(c)}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">{c.cnpj || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{(c as any).tipo || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.is_active ? "default" : "secondary"} className="text-xs">
                        {c.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); openEdit(c); }}>Editar</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div><Label>Nome *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>CNPJ</Label><Input value={form.cnpj} onChange={(e) => setForm({ ...form, cnpj: e.target.value })} /></div>
            <div>
              <Label>Tipo</Label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Engenheiro Responsável</Label><Input value={form.contato_engenheiro} onChange={(e) => setForm({ ...form, contato_engenheiro: e.target.value })} /></div>
            <div><Label>Contato Financeiro</Label><Input value={form.contato_financeiro} onChange={(e) => setForm({ ...form, contato_financeiro: e.target.value })} /></div>
            <div><Label>Observações</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={createClient.isPending || updateClient.isPending}>
              {(createClient.isPending || updateClient.isPending) ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
