import { useState, useMemo } from "react";
import { useEmployees, useCreateEmployee, useUpdateEmployee, useDeleteEmployee } from "@/hooks/useEmployees";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@/components/ui/pagination";
import { Search, Plus, Users, MoreVertical, Pencil, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Employee } from "@/hooks/useEmployees";

const statusConfig: Record<string, { label: string; className: string }> = {
  disponivel: { label: "Disponível", className: "bg-green-600 text-white" },
  ferias: { label: "Férias", className: "bg-amber-500 text-white" },
  licenca: { label: "Licença", className: "bg-orange-500 text-white" },
  afastado: { label: "Afastado", className: "bg-red-600 text-white" },
  desligado: { label: "Desligado", className: "bg-muted text-muted-foreground" },
};

const PAGE_SIZE = 20;

export default function Funcionarios() {
  const { data: employees = [], isLoading } = useEmployees();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [roleFilter, setRoleFilter] = useState<string>("todos");
  const [page, setPage] = useState(1);

  // New employee dialog
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newAdmission, setNewAdmission] = useState("");
  const [newStatus, setNewStatus] = useState("disponivel");

  // Edit dialog
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editAdmission, setEditAdmission] = useState("");

  // Status change dialog
  const [statusEmp, setStatusEmp] = useState<Employee | null>(null);
  const [newStatusValue, setNewStatusValue] = useState("");

  // Delete confirm
  const [deleteEmp, setDeleteEmp] = useState<Employee | null>(null);

  // Unique roles for filter
  const uniqueRoles = useMemo(() => {
    const roles = new Set(employees.map((e) => e.role).filter(Boolean));
    return Array.from(roles).sort();
  }, [employees]);

  // Filtering
  const filtered = employees.filter((e) => {
    const matchesSearch = e.name.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "todos" || e.status === statusFilter;
    const matchesRole = roleFilter === "todos" || e.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Summary counts
  const totalCount = employees.length;
  const disponiveisCount = employees.filter((e) => e.status === "disponivel").length;
  const campoCount = employees.filter((e) => ["topógrafo", "ajudante"].some((r) => (e.role || "").toLowerCase().includes(r))).length;
  const afastadosFeriasCount = employees.filter((e) => e.status === "ferias" || e.status === "afastado").length;

  const summaryCards = [
    { label: "Total de Funcionários", value: totalCount, color: "text-primary" },
    { label: "Disponíveis", value: disponiveisCount, color: "text-green-600" },
    { label: "Campo", value: campoCount, color: "text-amber-600" },
    { label: "Afastados / Férias", value: afastadosFeriasCount, color: "text-red-600" },
  ];

  // Handlers
  const handleCreate = async () => {
    if (!newName.trim()) { toast.error("Nome é obrigatório"); return; }
    try {
      await createEmployee.mutateAsync({
        name: newName.trim(),
        role: newRole.trim() || "Ajudante",
        admission_date: newAdmission || null,
        status: newStatus as any,
      });
      toast.success("Funcionário cadastrado!");
      setShowNew(false);
      setNewName(""); setNewRole(""); setNewAdmission(""); setNewStatus("disponivel");
    } catch { toast.error("Erro ao cadastrar"); }
  };

  const openEdit = (emp: Employee) => {
    setEditEmp(emp);
    setEditName(emp.name);
    setEditRole(emp.role);
    setEditAdmission(emp.admission_date || "");
  };

  const handleEdit = async () => {
    if (!editEmp || !editName.trim()) return;
    try {
      await updateEmployee.mutateAsync({
        id: editEmp.id,
        name: editName.trim(),
        role: editRole.trim() || "Ajudante",
        admission_date: editAdmission || null,
      });
      toast.success("Funcionário atualizado!");
      setEditEmp(null);
    } catch { toast.error("Erro ao atualizar"); }
  };

  const openStatusChange = (emp: Employee) => {
    setStatusEmp(emp);
    setNewStatusValue(emp.status);
  };

  const handleStatusChange = async () => {
    if (!statusEmp) return;
    try {
      await updateEmployee.mutateAsync({ id: statusEmp.id, status: newStatusValue as any });
      toast.success("Status atualizado!");
      setStatusEmp(null);
    } catch { toast.error("Erro ao alterar status"); }
  };

  const handleDelete = async () => {
    if (!deleteEmp) return;
    try {
      await deleteEmployee.mutateAsync(deleteEmp.id);
      toast.success("Funcionário excluído");
      setDeleteEmp(null);
    } catch { toast.error("Erro ao excluir"); }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Users className="w-6 h-6" /> Funcionários
          </h1>
          <p className="text-muted-foreground text-sm">
            {filtered.length} funcionário{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="w-4 h-4 mr-1" /> Novo Funcionário
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {summaryCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="pt-4 pb-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4 pb-4 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Select value={roleFilter} onValueChange={(v) => { setRoleFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Função" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas as funções</SelectItem>
              {uniqueRoles.map((r) => (
                <SelectItem key={r} value={r}>{r}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              <SelectItem value="disponivel">Disponível</SelectItem>
              <SelectItem value="ferias">Férias</SelectItem>
              <SelectItem value="afastado">Afastado</SelectItem>
              <SelectItem value="licenca">Licença</SelectItem>
              <SelectItem value="desligado">Desligado</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">Lista de Funcionários</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : paginated.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum funcionário encontrado.</p>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                     <TableHead>Matrícula</TableHead>
                     <TableHead>Nome</TableHead>
                     <TableHead>Função</TableHead>
                     <TableHead>Admissão</TableHead>
                     <TableHead>Status</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginated.map((emp) => {
                    const st = statusConfig[emp.status] || statusConfig.disponivel;
                    return (
                      <TableRow key={emp.id}>
                        <TableCell className="font-medium">{emp.name}</TableCell>
                        <TableCell>{emp.role}</TableCell>
                        <TableCell>
                          {emp.admission_date
                            ? format(new Date(emp.admission_date + "T00:00:00"), "dd/MM/yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={st.className}>{st.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(emp)}>
                                <Pencil className="w-4 h-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => openStatusChange(emp)}>
                                <RefreshCw className="w-4 h-4 mr-2" /> Alterar Status
                              </DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteEmp(emp)}>
                                <Trash2 className="w-4 h-4 mr-2" /> Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {totalPages > 1 && (
                <div className="mt-4">
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          className={currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .map((p, idx, arr) => (
                          <PaginationItem key={p}>
                            {idx > 0 && arr[idx - 1] !== p - 1 && (
                              <span className="px-2 text-muted-foreground">…</span>
                            )}
                            <PaginationLink
                              isActive={p === currentPage}
                              onClick={() => setPage(p)}
                              className="cursor-pointer"
                            >
                              {p}
                            </PaginationLink>
                          </PaginationItem>
                        ))}
                      <PaginationItem>
                        <PaginationNext
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          className={currentPage === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog: Novo Funcionário */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Funcionário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div>
              <Label>Função</Label>
              <Input value={newRole} onChange={(e) => setNewRole(e.target.value)} placeholder="Ex: Topógrafo I" />
            </div>
            <div>
              <Label>Data de Admissão</Label>
              <Input type="date" value={newAdmission} onChange={(e) => setNewAdmission(e.target.value)} />
            </div>
            <div>
              <Label>Status</Label>
              <Select value={newStatus} onValueChange={setNewStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="disponivel">Disponível</SelectItem>
                  <SelectItem value="ferias">Férias</SelectItem>
                  <SelectItem value="afastado">Afastado</SelectItem>
                  <SelectItem value="licenca">Licença</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={createEmployee.isPending}>
              {createEmployee.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Editar */}
      <Dialog open={!!editEmp} onOpenChange={(o) => !o && setEditEmp(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Funcionário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Função</Label>
              <Input value={editRole} onChange={(e) => setEditRole(e.target.value)} />
            </div>
            <div>
              <Label>Data de Admissão</Label>
              <Input type="date" value={editAdmission} onChange={(e) => setEditAdmission(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmp(null)}>Cancelar</Button>
            <Button onClick={handleEdit} disabled={updateEmployee.isPending}>
              {updateEmployee.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Alterar Status */}
      <Dialog open={!!statusEmp} onOpenChange={(o) => !o && setStatusEmp(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Alterar Status</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">{statusEmp?.name}</p>
          <Select value={newStatusValue} onValueChange={setNewStatusValue}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="disponivel">Disponível</SelectItem>
              <SelectItem value="ferias">Férias</SelectItem>
              <SelectItem value="afastado">Afastado</SelectItem>
              <SelectItem value="licenca">Licença</SelectItem>
              <SelectItem value="desligado">Desligado</SelectItem>
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusEmp(null)}>Cancelar</Button>
            <Button onClick={handleStatusChange} disabled={updateEmployee.isPending}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Confirmar Exclusão */}
      <AlertDialog open={!!deleteEmp} onOpenChange={(o) => !o && setDeleteEmp(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir funcionário?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteEmp?.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
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
