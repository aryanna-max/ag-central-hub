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
import { Search, Plus, Users, MoreVertical, Pencil, RefreshCw, Trash2, Download, UserMinus, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";
import AdmissaoWizard from "@/components/rh/AdmissaoWizard";
import DesligamentoDialog from "@/components/rh/DesligamentoDialog";
import EmployeeCompletudeBadge, { calculateCompletude } from "@/components/rh/EmployeeCompletudeBadge";
import { ALL_EMPLOYEE_ROLES } from "@/lib/fieldRoles";
import { formatCpf } from "@/lib/masks";
import { toast } from "sonner";
import { exportCsv } from "@/lib/exportCsv";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import type { Employee } from "@/hooks/useEmployees";
import { FIELD_ROLES, isFieldRole, isTechRole } from "@/lib/fieldRoles";
import ColumnToggle, { useColumnVisibility, type ColumnDef } from "@/components/ColumnToggle";
import { SortableTableHead, useSortableTable } from "@/components/ui/sortable-table-head";

const statusConfig: Record<string, { label: string; className: string }> = {
  disponivel: { label: "Disponível", className: "bg-green-600 text-white" },
  ferias: { label: "Férias", className: "bg-amber-500 text-white" },
  licenca: { label: "Licença", className: "bg-orange-500 text-white" },
  afastado: { label: "Afastado", className: "bg-red-600 text-white" },
  desligado: { label: "Desligado", className: "bg-muted text-muted-foreground" },
};

const PAGE_SIZE = 20;

type TransporteTipo = "vt_cartao" | "dinheiro" | "nenhum";

const TRANSPORTE_LABELS: Record<TransporteTipo, string> = {
  vt_cartao: "Cartão (VT/VEM)",
  dinheiro: "Dinheiro",
  nenhum: "Nenhum",
};

function deriveTransporteTipo(emp: Employee | null): TransporteTipo {
  if (!emp) return "vt_cartao";
  const e = emp as Employee & {
    transporte_tipo?: string | null;
    has_vt?: boolean | null;
    vt_cash?: boolean | null;
  };
  if (e.transporte_tipo === "vt_cartao" || e.transporte_tipo === "dinheiro" || e.transporte_tipo === "nenhum") {
    return e.transporte_tipo;
  }
  // Fallback para legacy (compatibilidade)
  if (e.has_vt === false) return "nenhum";
  if (e.vt_cash === true) return "dinheiro";
  return "vt_cartao";
}

function validateMatricula(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  if (/^000\d{3}$/.test(trimmed)) return null; // CLT valid
  if (/^PREST-\d{3}$/.test(trimmed)) return null; // Prestador valid
  return "Matrícula deve ser formato 000XXX (CLT) ou PREST-XXX (prestador)";
}

export default function Funcionarios() {
  const { data: employees = [], isLoading } = useEmployees();
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const deleteEmployee = useDeleteEmployee();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("todos");
  const [roleFilter, setRoleFilter] = useState<string>("todos");
  const [page, setPage] = useState(1);

  const EMP_COLUMNS: ColumnDef[] = [
    { key: "matricula", label: "Matrícula" },
    { key: "tipo", label: "Tipo" },
    { key: "nome", label: "Nome" },
    { key: "funcao", label: "Função" },
    { key: "admissao", label: "Admissão" },
    { key: "status", label: "Status" },
    { key: "completude", label: "Cadastro" },
  ];
  const navigate = useNavigate();
  const { visibleColumns, toggle: toggleColumn, isVisible } = useColumnVisibility(EMP_COLUMNS);

  const [showNew, setShowNew] = useState(false);

  // Edit dialog
  const [editEmp, setEditEmp] = useState<Employee | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editAdmission, setEditAdmission] = useState("");
  const [editTransporteTipo, setEditTransporteTipo] = useState<TransporteTipo>("vt_cartao");

  // Status change dialog
  const [statusEmp, setStatusEmp] = useState<Employee | null>(null);
  const [newStatusValue, setNewStatusValue] = useState("");

  // Delete confirm
  const [deleteEmp, setDeleteEmp] = useState<Employee | null>(null);

  // Termination dialog (Desligar/Reativar)
  const [terminateEmp, setTerminateEmp] = useState<Employee | null>(null);

  // Unique roles for filter
  const uniqueRoles = useMemo(() => {
    const roles = new Set(employees.map((e) => e.role).filter(Boolean));
    return Array.from(roles).sort();
  }, [employees]);

  // Filtering
  const filtered = employees.filter((e) => {
    const q = search.toLowerCase();
    const matchesSearch = e.name.toLowerCase().includes(q) || e.role?.toLowerCase().includes(q) || e.cpf?.includes(q) || e.matricula?.includes(q);
    const matchesStatus = statusFilter === "todos" || e.status === statusFilter;
    const matchesRole = roleFilter === "todos" || e.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  const { sorted: sortedFiltered, sortKey, sortDir, handleSort } = useSortableTable(filtered);
  const totalPages = Math.max(1, Math.ceil(sortedFiltered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paginated = sortedFiltered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Summary counts
  const totalCount = employees.length;
  const campoCount = employees.filter((e) => isFieldRole(e.role)).length;
  const salaTecnicaCount = employees.filter((e) => isTechRole(e.role)).length;
  const adminCount = totalCount - campoCount - salaTecnicaCount;

  const summaryCards = [
    { label: "Total", value: totalCount, color: "text-primary" },
    { label: "Campo", value: campoCount, color: "text-amber-600" },
    { label: "Sala Técnica", value: salaTecnicaCount, color: "text-blue-600" },
    { label: "Administrativo", value: adminCount, color: "text-gray-600" },
  ];

  const getTypeBadge = (matricula?: string | null) => {
    if (!matricula) return null;
    if (matricula.startsWith("000")) return <Badge className="bg-blue-600 text-white text-[10px] px-1.5">CLT</Badge>;
    if (matricula.toUpperCase().startsWith("PREST")) return <Badge className="bg-muted text-muted-foreground text-[10px] px-1.5">PREST</Badge>;
    return null;
  };

  // Handler de criação: removido.
  // AdmissaoWizard (4 passos, 32 campos Fase 3B) agora cuida da admissão completa.

  const openEdit = (emp: Employee) => {
    setEditEmp(emp);
    setEditName(emp.name);
    setEditRole(emp.role);
    setEditAdmission(emp.admission_date || "");
    setEditTransporteTipo(deriveTransporteTipo(emp));
  };

  const handleEdit = async () => {
    if (!editEmp || !editName.trim()) return;
    try {
      await updateEmployee.mutateAsync({
        id: editEmp.id,
        name: editName.trim(),
        role: editRole.trim() || "Ajudante de Topografia",
        admission_date: editAdmission || null,
        transporte_tipo: editTransporteTipo,
      });
      // Sincronizar colunas legacy (has_vt/vt_cash) para compatibilidade.
      await supabase.from("employees").update({
        has_vt: editTransporteTipo !== "nenhum",
        vt_cash: editTransporteTipo === "dinheiro",
      }).eq("id", editEmp.id);
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
      await updateEmployee.mutateAsync({ id: statusEmp.id, status: newStatusValue as Employee["status"] });
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
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => {
            const rows = filtered.map((e: any) => [e.matricula || "", e.name, e.role || "", e.cpf || "", e.admission_date || "", e.status || "", e.has_vt ? "Sim" : "Não"]);
            exportCsv(["Matrícula", "Nome", "Função", "CPF", "Admissão", "Status", "VT"], rows, "funcionarios.csv");
            toast.success(`${rows.length} funcionários exportados`);
          }}><Download className="w-4 h-4 mr-1" /> Exportar</Button>
          <Button onClick={() => setShowNew(true)}>
            <Plus className="w-4 h-4 mr-1" /> Novo Funcionário
          </Button>
        </div>
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
              placeholder="Buscar por nome, CPF ou matrícula..."
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
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Lista de Funcionários</CardTitle>
          <ColumnToggle columns={EMP_COLUMNS} visibleColumns={visibleColumns} onToggle={toggleColumn} />
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground text-center py-8">Carregando...</p>
          ) : paginated.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">Nenhum funcionário encontrado.</p>
          ) : (
            <>
              <div className="overflow-x-auto scrollbar-thin">
                <Table>
                  <TableHeader>
                    <TableRow>
                       {isVisible("matricula") && <SortableTableHead sortKey="matricula" currentSort={sortKey} currentDir={sortDir} onSort={handleSort}>Matrícula</SortableTableHead>}
                       {isVisible("tipo") && <SortableTableHead>Tipo</SortableTableHead>}
                       {isVisible("nome") && <SortableTableHead sortKey="name" currentSort={sortKey} currentDir={sortDir} onSort={handleSort}>Nome</SortableTableHead>}
                       {isVisible("funcao") && <SortableTableHead sortKey="role" currentSort={sortKey} currentDir={sortDir} onSort={handleSort}>Função</SortableTableHead>}
                       {isVisible("admissao") && <SortableTableHead sortKey="admission_date" currentSort={sortKey} currentDir={sortDir} onSort={handleSort}>Admissão</SortableTableHead>}
                       {isVisible("status") && <SortableTableHead sortKey="status" currentSort={sortKey} currentDir={sortDir} onSort={handleSort}>Status</SortableTableHead>}
                       {isVisible("completude") && <TableHead className="w-[90px]">Cadastro</TableHead>}
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((emp) => {
                      const st = statusConfig[emp.status] || statusConfig.disponivel;
                      const completude = calculateCompletude(emp as unknown as Record<string, unknown>);
                      return (
                        <TableRow
                          key={emp.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => navigate(`/rh/funcionarios/${emp.id}`)}
                        >
                           {isVisible("matricula") && <TableCell className="font-mono text-xs text-muted-foreground">{emp.matricula || "—"}</TableCell>}
                           {isVisible("tipo") && <TableCell>{getTypeBadge(emp.matricula)}</TableCell>}
                           {isVisible("nome") && <TableCell className="font-medium">{emp.name}</TableCell>}
                          {isVisible("funcao") && <TableCell>{emp.role}</TableCell>}
                          {isVisible("admissao") && <TableCell>
                            {emp.admission_date
                              ? format(new Date(emp.admission_date + "T00:00:00"), "dd/MM/yyyy")
                              : "—"}
                          </TableCell>}
                          {isVisible("status") && <TableCell>
                            <Badge className={st.className}>{st.label}</Badge>
                          </TableCell>}
                          {isVisible("completude") && <TableCell>
                            <EmployeeCompletudeBadge completude={completude} size="small" />
                          </TableCell>}
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8">
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => navigate(`/rh/funcionarios/${emp.id}`)}>
                                  <Eye className="w-4 h-4 mr-2" /> Ver ficha completa
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openEdit(emp)}>
                                  <Pencil className="w-4 h-4 mr-2" /> Editar rápido
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openStatusChange(emp)}>
                                  <RefreshCw className="w-4 h-4 mr-2" /> Alterar Status
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setTerminateEmp(emp)}>
                                  <UserMinus className="w-4 h-4 mr-2" />
                                  {emp.status === "desligado" ? "Reativar" : "Desligar"}
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
              </div>

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

      {/* Wizard: Nova Admissão (4 passos, 32 campos Fase 3B) */}
      <AdmissaoWizard open={showNew} onOpenChange={setShowNew} />

      {/* Dialog: Desligar / Reativar */}
      <DesligamentoDialog
        employee={terminateEmp}
        open={!!terminateEmp}
        onOpenChange={(o) => !o && setTerminateEmp(null)}
      />

      {/* Dialog: Editar */}
      <Dialog open={!!editEmp} onOpenChange={(o) => !o && setEditEmp(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Funcionário</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {editEmp?.matricula && (
              <div>
                <Label>Matrícula</Label>
                <div className="flex items-center gap-2">
                  <Input value={editEmp.matricula} readOnly disabled className="bg-muted flex-1" />
                  {getTypeBadge(editEmp.matricula)}
                </div>
              </div>
            )}
            <div>
              <Label>Nome *</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <Label>Função</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger><SelectValue placeholder="Selecione a função..." /></SelectTrigger>
                <SelectContent>
                  {ALL_EMPLOYEE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de Admissão</Label>
              <Input type="date" value={editAdmission} onChange={(e) => setEditAdmission(e.target.value)} />
            </div>
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Transporte</p>
              <div>
                <Label>Tipo de transporte</Label>
                <Select value={editTransporteTipo} onValueChange={(v) => setEditTransporteTipo(v as TransporteTipo)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TRANSPORTE_LABELS) as TransporteTipo[]).map((k) => (
                      <SelectItem key={k} value={k}>{TRANSPORTE_LABELS[k]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Valor do VT vem de system_settings (padrão R$ 4,50 × 2 viagens).
                </p>
              </div>
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
