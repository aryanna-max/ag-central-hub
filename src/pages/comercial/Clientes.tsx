import { useState, useMemo } from "react";
import { Building2, Search, Mail, Phone, FileText, Plus, MoreHorizontal, Pencil, Trash2, UserPlus, Users, FolderOpen, Eye, Ban } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  useClients, useClientContacts, useCreateClientContact, useDeleteClientContact, useDeleteClient, useUpdateClient,
  type Client, type ClientContactInsert,
} from "@/hooks/useClients";
import { useProjects, type Project } from "@/hooks/useProjects";
import ClientFormDialog from "./ClientFormDialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const PROJECT_STATUS_LABELS: Record<string, string> = {
  planejamento: "Planejamento", execucao: "Execução", entrega: "Entrega",
  faturamento: "Faturamento", concluido: "Concluído", pausado: "Pausado",
};

export default function Clientes() {
  const { data: clients = [], isLoading } = useClients();
  const { data: projects = [] } = useProjects();
  const deleteClient = useDeleteClient();
  const updateClient = useUpdateClient();

  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [historyClient, setHistoryClient] = useState<Client | null>(null);

  const getClientProjects = (client: Client): Project[] =>
    projects.filter(
      (p) => p.client_id === client.id
    );

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return clients.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.cnpj?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.city?.toLowerCase().includes(q) ||
        c.segmento?.toLowerCase().includes(q) ||
        c.codigo?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const stats = useMemo(() => ({
    total: clients.length,
    active: clients.filter((c) => c.is_active).length,
    totalProjects: clients.reduce((s, c) => s + getClientProjects(c).length, 0),
  }), [clients, projects]);

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

  const handleToggleActive = async (client: Client) => {
    try {
      await updateClient.mutateAsync({ id: client.id, is_active: !client.is_active });
      toast.success(client.is_active ? "Cliente desativado" : "Cliente reativado");
    } catch {
      toast.error("Erro ao alterar status");
    }
  };

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-6">
      {/* Header */}
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
      <div className="grid grid-cols-3 gap-4">
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Building2 className="w-4 h-4" />Total de Clientes</div>
          <p className="text-2xl font-bold">{stats.total}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Users className="w-4 h-4" />Clientes Ativos</div>
          <p className="text-2xl font-bold">{stats.active}</p>
        </CardContent></Card>
        <Card><CardContent className="pt-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><FolderOpen className="w-4 h-4" />Total de Projetos</div>
          <p className="text-2xl font-bold">{stats.totalProjects}</p>
        </CardContent></Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="clientes" className="space-y-4">
        <TabsList>
          <TabsTrigger value="clientes">Base de Clientes</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-4">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Buscar clientes..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>

          {isLoading ? (
            <p className="text-muted-foreground text-center py-10">Carregando...</p>
          ) : filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">Nenhum cliente encontrado.</p>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome / Razão Social</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Cidade/UF</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Segmento</TableHead>
                      <TableHead className="text-center">Projetos</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-10"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((client) => {
                      const projCount = getClientProjects(client).length;
                      return (
                        <TableRow key={client.id} className="cursor-pointer hover:bg-muted/50">
                          <TableCell className="font-medium" onClick={() => setSelectedClient(client)}>{client.name}</TableCell>
                          <TableCell className="text-muted-foreground text-xs font-mono">{client.cnpj || "—"}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {client.city ? `${client.city}${client.state ? `/${client.state}` : ""}` : "—"}
                          </TableCell>
                          <TableCell>
                            <div className="text-xs space-y-0.5">
                              {client.phone && <div className="flex items-center gap-1 text-muted-foreground"><Phone className="w-3 h-3" />{client.phone}</div>}
                              {client.email && <div className="flex items-center gap-1 text-muted-foreground"><Mail className="w-3 h-3" />{client.email}</div>}
                              {!client.phone && !client.email && <span className="text-muted-foreground">—</span>}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">{client.segmento || "—"}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary" className="text-xs">{projCount}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={client.is_active ? "default" : "secondary"} className="text-xs">
                              {client.is_active ? "Ativo" : "Inativo"}
                            </Badge>
                          </TableCell>
                          <TableCell>
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
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setHistoryClient(client); }}>
                                  <Eye className="w-3.5 h-3.5 mr-2" /> Ver Projetos
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleToggleActive(client); }}>
                                  <Ban className="w-3.5 h-3.5 mr-2" /> {client.is_active ? "Desativar" : "Reativar"}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="historico" className="space-y-4">
          <p className="text-sm text-muted-foreground">Selecione um cliente para ver seus projetos vinculados</p>
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-10">Nenhum cliente encontrado.</p>
          ) : (
            <div className="space-y-3">
              {filtered.map((client) => {
                const clientProjects = getClientProjects(client);
                const totalContracted = clientProjects.reduce((s, p) => s + (p.contract_value || 0), 0);
                return (
                  <Card key={client.id} className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setHistoryClient(client)}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold">{client.name}</p>
                          {client.cnpj && <p className="text-xs text-muted-foreground font-mono">{client.cnpj}</p>}
                        </div>
                        <div className="text-right">
                          <Badge variant="secondary" className="text-xs">{clientProjects.length} projeto(s)</Badge>
                          {totalContracted > 0 && (
                            <p className="text-sm font-semibold mt-1">{fmt(totalContracted)}</p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Client projects dialog (Ver Projetos) */}
      <ClientProjectsDialog client={historyClient} open={!!historyClient} onOpenChange={() => setHistoryClient(null)} projects={projects} />

      {/* Client detail dialog */}
      <ClientDetailDialog client={selectedClient} open={!!selectedClient} onOpenChange={() => setSelectedClient(null)} />

      <ClientFormDialog open={formOpen} onOpenChange={setFormOpen} client={editingClient} />

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

/* ---------- Client Projects Dialog ---------- */
function ClientProjectsDialog({ client, open, onOpenChange, projects }: { client: Client | null; open: boolean; onOpenChange: (o: boolean) => void; projects: Project[] }) {
  if (!client) return null;

  const clientProjects = projects.filter(
    (p) => p.client_id === client.id
  );
  const totalContracted = clientProjects.reduce((s, p) => s + (p.contract_value || 0), 0);
  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="w-5 h-5" />
            Projetos — {client.name}
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-4 text-sm">
          <div className="bg-muted/50 rounded-md p-3 flex-1 text-center">
            <p className="text-muted-foreground text-xs">Nº de Projetos</p>
            <p className="text-xl font-bold">{clientProjects.length}</p>
          </div>
          <div className="bg-muted/50 rounded-md p-3 flex-1 text-center">
            <p className="text-muted-foreground text-xs">Total Contratado</p>
            <p className="text-xl font-bold">{fmt(totalContracted)}</p>
          </div>
        </div>

        <Separator />

        <ScrollArea className="flex-1">
          {clientProjects.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">Nenhum projeto vinculado a este cliente.</p>
          ) : (
            <div className="space-y-2">
              {clientProjects.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-3 rounded-md bg-muted/50 text-sm">
                  <div>
                    <p className="font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {p.service || "Sem serviço"} · {PROJECT_STATUS_LABELS[p.status] || p.status}
                      {p.start_date && ` · ${format(new Date(p.start_date), "dd/MM/yyyy", { locale: ptBR })}`}
                    </p>
                  </div>
                  <div className="text-right">
                    {p.contract_value != null && <p className="font-semibold">{fmt(p.contract_value)}</p>}
                    <Badge variant="outline" className="text-[10px]">{PROJECT_STATUS_LABELS[p.status]}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- Client Detail Dialog ---------- */
function ClientDetailDialog({ client, open, onOpenChange }: { client: Client | null; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { data: contacts = [] } = useClientContacts(client?.id);
  const createContact = useCreateClientContact();
  const deleteContact = useDeleteClientContact();

  const [showAddContact, setShowAddContact] = useState(false);
  const [contactForm, setContactForm] = useState<Omit<ClientContactInsert, "client_id">>({ contact_name: "" });

  if (!client) return null;

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
      <DialogContent className="sm:max-w-lg max-h-[80vh] flex flex-col">
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
              <FileText className="w-4 h-4" /> <span className="font-medium text-foreground font-mono">{client.cnpj}</span>
            </div>
          )}
          {client.phone && <div className="flex items-center gap-2 text-muted-foreground"><Phone className="w-4 h-4" /> {client.phone}</div>}
          {client.email && <div className="flex items-center gap-2 text-muted-foreground"><Mail className="w-4 h-4" /> {client.email}</div>}
          {client.city && <div className="text-muted-foreground">{client.city}{client.state ? `/${client.state}` : ""}</div>}
          {client.segmento && <div className="text-muted-foreground">Segmento: <span className="font-medium text-foreground">{client.segmento}</span></div>}
        </div>

        {client.notes && <p className="text-sm bg-muted/50 rounded-md p-3">{client.notes}</p>}

        <Separator />

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
      </DialogContent>
    </Dialog>
  );
}
