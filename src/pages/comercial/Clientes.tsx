import { useState, useMemo } from "react";
import { Building2, Search, Mail, Phone, FileText, Plus, MoreHorizontal, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useClients, useClientContacts, useCreateClientContact, useDeleteClientContact, useDeleteClient, type Client, type ClientContactInsert } from "@/hooks/useClients";
import { useProjects } from "@/hooks/useProjects";
import ClientFormDialog from "./ClientFormDialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const STATUS_LABELS: Record<string, string> = {
  planejamento: "Planejamento",
  execucao: "Execução",
  entrega: "Entrega",
  faturamento: "Faturamento",
  concluido: "Concluído",
  pausado: "Pausado",
};

export default function Clientes() {
  const { data: clients = [], isLoading } = useClients();
  const { data: projects = [] } = useProjects();
  const deleteClient = useDeleteClient();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.cnpj?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const getClientProjects = (client: Client) =>
    projects.filter((p) => p.client?.toLowerCase().trim() === client.name.toLowerCase().trim() || (client.cnpj && p.client_cnpj === client.cnpj));

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteClient.mutateAsync(deleteId);
      toast.success("Cliente excluído");
    } catch {
      toast.error("Erro ao excluir");
    }
    setDeleteId(null);
  };

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const totalProjects = clients.reduce((s, c) => s + getClientProjects(c).length, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Empresas que já contrataram a AG</p>
        </div>
        <Button onClick={() => { setEditingClient(null); setFormOpen(true); }}>
          <Plus className="w-4 h-4 mr-2" /> Novo Cliente
        </Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="w-4 h-4" />Total de Clientes</div>
          <p className="text-2xl font-bold">{clients.length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="w-4 h-4" />Ativos</div>
          <p className="text-2xl font-bold">{clients.filter((c) => c.is_active).length}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="w-4 h-4" />Projetos Vinculados</div>
          <p className="text-2xl font-bold">{totalProjects}</p>
        </CardContent></Card>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Buscar clientes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Client cards */}
      {isLoading ? (
        <p className="text-muted-foreground text-center py-10">Carregando...</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground text-center py-10">Nenhum cliente encontrado.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((client) => {
            const clientProjects = getClientProjects(client);
            return (
              <Card
                key={client.id}
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setSelectedClient(client)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{client.name}</p>
                      {client.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {client.cnpj}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      <Badge variant={client.is_active ? "default" : "secondary"} className="text-xs">
                        {client.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setEditingClient(client); setFormOpen(true); }}>
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteId(client.id); }}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {client.city && <p className="text-xs text-muted-foreground">{client.city}{client.state ? ` - ${client.state}` : ""}</p>}
                  <div className="flex gap-3 text-xs text-muted-foreground">
                    {client.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{client.phone}</span>}
                    {client.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{client.email}</span>}
                  </div>
                  {clientProjects.length > 0 && (
                    <Badge variant="secondary" className="text-xs">{clientProjects.length} projeto(s)</Badge>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ClientFormDialog open={formOpen} onOpenChange={setFormOpen} client={editingClient} />
      <ClientDetailDialog client={selectedClient} open={!!selectedClient} onOpenChange={() => setSelectedClient(null)} />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação excluirá também todos os contatos vinculados.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ---------- Client Detail Dialog ---------- */
function ClientDetailDialog({ client, open, onOpenChange }: { client: Client | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: contacts = [] } = useClientContacts(client?.id);
  const { data: projects = [] } = useProjects();
  const createContact = useCreateClientContact();
  const deleteContact = useDeleteClientContact();

  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState<Omit<ClientContactInsert, "client_id">>({ contact_name: "" });

  if (!client) return null;

  const clientProjects = projects.filter(
    (p) => p.client?.toLowerCase().trim() === client.name.toLowerCase().trim() || (client.cnpj && p.client_cnpj === client.cnpj)
  );

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  const handleAddContact = async () => {
    if (!contactForm.contact_name.trim()) return;
    try {
      await createContact.mutateAsync({ ...contactForm, client_id: client.id });
      setContactForm({ contact_name: "" });
      setShowAddContact(false);
      toast.success("Contato adicionado");
    } catch {
      toast.error("Erro ao adicionar contato");
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    try {
      await deleteContact.mutateAsync({ id: contactId, clientId: client.id });
      toast.success("Contato removido");
    } catch {
      toast.error("Erro ao remover contato");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5" />
            {client.name}
            <Badge variant={client.is_active ? "default" : "secondary"} className="text-xs ml-2">
              {client.is_active ? "Ativo" : "Inativo"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          {client.cnpj && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <FileText className="w-4 h-4" /> CNPJ: <span className="font-medium text-foreground">{client.cnpj}</span>
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-4 h-4" /> {client.phone}
            </div>
          )}
          {client.email && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-4 h-4" /> {client.email}
            </div>
          )}
          {client.address && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Building2 className="w-4 h-4" /> {client.address}
              {client.city && ` · ${client.city}`}
              {client.state && ` - ${client.state}`}
            </div>
          )}
        </div>

        {client.notes && <p className="text-sm bg-muted/50 rounded-md p-3">{client.notes}</p>}

        <Separator />

        {/* Contacts */}
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Contatos ({contacts.length})</p>
          <Button variant="ghost" size="sm" onClick={() => setShowAddContact(!showAddContact)}>
            <UserPlus className="w-4 h-4 mr-1" /> Adicionar
          </Button>
        </div>

        {showAddContact && (
          <div className="grid grid-cols-4 gap-2 items-end">
            <div className="space-y-1">
              <Label className="text-xs">Nome *</Label>
              <Input value={contactForm.contact_name} onChange={(e) => setContactForm({ ...contactForm, contact_name: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Telefone</Label>
              <Input value={contactForm.contact_phone || ""} onChange={(e) => setContactForm({ ...contactForm, contact_phone: e.target.value })} className="h-8 text-sm" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">E-mail</Label>
              <Input value={contactForm.contact_email || ""} onChange={(e) => setContactForm({ ...contactForm, contact_email: e.target.value })} className="h-8 text-sm" />
            </div>
            <Button size="sm" onClick={handleAddContact} disabled={createContact.isPending}>Salvar</Button>
          </div>
        )}

        <ScrollArea className="max-h-28">
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-2">Nenhum contato cadastrado.</p>
          ) : (
            <div className="space-y-1">
              {contacts.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                  <div>
                    <span className="font-medium">{c.contact_name}</span>
                    {c.role && <span className="text-xs text-muted-foreground ml-2">({c.role})</span>}
                    {c.is_primary && <Badge className="ml-2 text-[10px] h-4">Principal</Badge>}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {c.contact_phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{c.contact_phone}</span>}
                    {c.contact_email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{c.contact_email}</span>}
                    <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleDeleteContact(c.id)}>
                      <Trash2 className="w-3 h-3 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        <Separator />

        {/* Projects */}
        <p className="text-sm font-medium">Projetos ({clientProjects.length})</p>
        <ScrollArea className="max-h-36">
          {clientProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-3">Nenhum projeto vinculado.</p>
          ) : (
            <div className="space-y-2">
              {clientProjects.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50 text-sm">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.service || "Sem serviço"} · {STATUS_LABELS[p.status] || p.status}</p>
                  </div>
                  {p.contract_value != null && <p className="font-semibold text-sm">{fmt(p.contract_value)}</p>}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
