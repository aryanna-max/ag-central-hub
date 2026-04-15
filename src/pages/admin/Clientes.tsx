import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, Search, Plus, History, Download } from "lucide-react";
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
import { exportCsv } from "@/lib/exportCsv";

const TIPOS = ["Construtora", "Incorporadora", "Empresa privada", "Órgão público", "Pessoa física"] as const;

export default function AdminClientes() {
  const navigate = useNavigate();
  const { data: clients = [], isLoading } = useClients();
  const createClient = useCreateClient();
  const updateClient = useUpdateClient();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);

  const [form, setForm] = useState({
    codigo: "", name: "", cnpj: "", tipo: "", contato_cliente: "", contato_financeiro: "", notes: "",
  });

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      c.cnpj?.toLowerCase().includes(q) ||
      c.codigo?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const openNew = () => {
    setEditClient(null);
    setForm({ codigo: "", name: "", cnpj: "", tipo: "", contato_cliente: "", contato_financeiro: "", notes: "" });
    setFormOpen(true);
  };

  const openEdit = (c: Client) => {
    setEditClient(c);
    setForm({
      codigo: c.codigo || "",
      name: c.name,
      cnpj: c.cnpj || "",
      tipo: c.tipo || "",
      contato_cliente: c.contato_cliente || "",
      contato_financeiro: c.contato_financeiro || "",
      notes: c.notes || "",
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error("Nome é obrigatório"); return; }
    if (!form.codigo.trim()) { toast.error("Código é obrigatório"); return; }

    const codigoClean = form.codigo.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6);
    if (!codigoClean) { toast.error("Código deve conter apenas letras"); return; }

    // Check uniqueness
    const duplicate = clients.find(
      (c) => c.codigo?.toUpperCase() === codigoClean && c.id !== editClient?.id
    );
    if (duplicate) { toast.error(`Código "${codigoClean}" já usado por ${duplicate.name}`); return; }

    try {
      const payload = {
        codigo: codigoClean,
        name: form.name,
        cnpj: form.cnpj || null,
        tipo: form.tipo || null,
        contato_cliente: form.contato_cliente || null,
        contato_financeiro: form.contato_financeiro || null,
        notes: form.notes || null,
      };

      if (editClient) {
        await updateClient.mutateAsync({ id: editClient.id, ...payload } as any);
        toast.success("Cliente atualizado!");
      } else {
        await createClient.mutateAsync(payload as any);
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const rows = filtered.map((c: any) => [c.codigo || "", c.name, c.cnpj || "", c.tipo || "", c.contato_engenheiro || "", c.contato_financeiro || "", c.is_active ? "Ativo" : "Inativo"]);
            exportCsv(["Código", "Nome", "CNPJ", "Tipo", "Contato Eng.", "Contato Fin.", "Status"], rows, "clientes.csv");
            toast.success(`${rows.length} clientes exportados`);
          }}><Download className="w-4 h-4 mr-1" /> Exportar</Button>
          <Button onClick={openNew}><Plus className="w-4 h-4 mr-1" /> Novo Cliente</Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar por código, nome ou CNPJ..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
                  <TableHead className="w-24">Código</TableHead>
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
                    <TableCell className="font-mono font-bold text-primary text-sm">{c.codigo || "—"}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">{c.cnpj || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{c.tipo || "—"}</TableCell>
                    <TableCell>
                      <Badge variant={c.is_active ? "default" : "secondary"} className="text-xs">
                        {c.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); navigate(`/base/clientes/${c.id}`); }} title="Histórico">
                        <History className="w-4 h-4" />
                      </Button>
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
            <div>
              <Label>Código * <span className="text-xs text-muted-foreground">(máx 6 letras, ex: BRK, HBR)</span></Label>
              <Input
                value={form.codigo}
                onChange={(e) => setForm({ ...form, codigo: e.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 6) })}
                placeholder="Ex: BRK"
                maxLength={6}
                className="font-mono uppercase"
              />
            </div>
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
            <div><Label>Contato do Cliente</Label><Input value={form.contato_cliente} onChange={(e) => setForm({ ...form, contato_cliente: e.target.value })} /></div>
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
