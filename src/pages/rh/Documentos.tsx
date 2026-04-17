import { useState, useMemo } from "react";
import { useEmployees } from "@/hooks/useEmployees";
import {
  useEmployeeDocuments,
  useCriticalDocuments,
  useUpsertEmployeeDocument,
  useDeleteEmployeeDocument,
  DOC_TYPE_LABELS,
} from "@/hooks/useEmployeeDocuments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Search,
  Plus,
  FileCheck,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { format, differenceInDays, parseISO, addYears } from "date-fns";

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  valido: { label: "Válido", className: "bg-green-600 text-white" },
  proximo_vencer: { label: "A vencer", className: "bg-amber-500 text-white" },
  vencido: { label: "Vencido", className: "bg-red-600 text-white" },
  pendente: { label: "Pendente", className: "bg-muted text-muted-foreground" },
  em_analise: { label: "Em análise", className: "bg-blue-500 text-white" },
};

function suggestExpiry(docType: string, issueDate: string | null): string | null {
  if (!issueDate) return null;
  const issued = parseISO(issueDate);
  if (docType === "aso") return format(addYears(issued, 1), "yyyy-MM-dd");
  if (docType === "nr18" || docType === "nr35" || docType === "nr10" || docType === "nr33")
    return format(addYears(issued, 2), "yyyy-MM-dd");
  return null;
}

interface DocFormState {
  id?: string;
  employee_id: string;
  doc_type: string;
  issue_date: string;
  expiry_date: string;
  notes: string;
}

function EmployeeDocsPanel({ employeeId }: { employeeId: string }) {
  const { data: docs = [], isLoading } = useEmployeeDocuments(employeeId);
  const upsert = useUpsertEmployeeDocument();
  const remove = useDeleteEmployeeDocument();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<DocFormState>({
    employee_id: employeeId,
    doc_type: "aso",
    issue_date: "",
    expiry_date: "",
    notes: "",
  });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  function openNew() {
    setForm({ employee_id: employeeId, doc_type: "aso", issue_date: "", expiry_date: "", notes: "" });
    setDialogOpen(true);
  }

  function openEdit(d: any) {
    setForm({
      id: d.id,
      employee_id: employeeId,
      doc_type: d.doc_type,
      issue_date: d.issue_date ?? "",
      expiry_date: d.expiry_date ?? "",
      notes: d.notes ?? "",
    });
    setDialogOpen(true);
  }

  function handleIssueChange(value: string) {
    const suggested = suggestExpiry(form.doc_type, value || null);
    setForm({ ...form, issue_date: value, expiry_date: suggested ?? form.expiry_date });
  }

  function handleTypeChange(value: string) {
    const suggested = suggestExpiry(value, form.issue_date || null);
    setForm({ ...form, doc_type: value, expiry_date: suggested ?? form.expiry_date });
  }

  async function handleSave() {
    try {
      await upsert.mutateAsync({
        id: form.id,
        employee_id: employeeId,
        doc_type: form.doc_type,
        issue_date: form.issue_date || null,
        expiry_date: form.expiry_date || null,
        notes: form.notes || null,
      });
      toast.success("Documento salvo");
      setDialogOpen(false);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao salvar documento");
    }
  }

  async function handleDelete(id: string) {
    try {
      await remove.mutateAsync({ id, employeeId });
      toast.success("Documento removido");
      setConfirmDelete(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao remover");
    }
  }

  return (
    <div className="bg-muted/30 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">Documentos</h4>
        <Button size="sm" onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar documento
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum documento cadastrado.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Emissão</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(docs as any[]).map((d) => {
              const cfg = STATUS_BADGE[d.doc_status] ?? STATUS_BADGE.pendente;
              return (
                <TableRow key={d.id}>
                  <TableCell>{DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}</TableCell>
                  <TableCell>{d.issue_date ? format(parseISO(d.issue_date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell>{d.expiry_date ? format(parseISO(d.expiry_date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell>
                    <Badge className={cfg.className}>{cfg.label}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(d.id)}>
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar documento" : "Novo documento"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={form.doc_type} onValueChange={handleTypeChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data emissão</Label>
                <Input type="date" value={form.issue_date} onChange={(e) => handleIssueChange(e.target.value)} />
              </div>
              <div>
                <Label>Data validade</Label>
                <Input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={upsert.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover documento?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDelete && handleDelete(confirmDelete)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function Documentos() {
  const { data: employees = [], isLoading } = useEmployees();
  const { data: critical = [] } = useCriticalDocuments();
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const criticalByEmployee = useMemo(() => {
    const map = new Map<string, { vencido: number; a_vencer: number }>();
    (critical as any[]).forEach((d) => {
      const cur = map.get(d.employee_id) ?? { vencido: 0, a_vencer: 0 };
      if (d.doc_status === "vencido") cur.vencido++;
      else if (d.doc_status === "proximo_vencer") cur.a_vencer++;
      map.set(d.employee_id, cur);
    });
    return map;
  }, [critical]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter(
      (e) => e.name.toLowerCase().includes(term) || (e.matricula ?? "").toLowerCase().includes(term)
    );
  }, [employees, search]);

  const sortedCritical = useMemo(() => {
    return [...(critical as any[])].sort((a, b) => {
      if (a.doc_status === "vencido" && b.doc_status !== "vencido") return -1;
      if (a.doc_status !== "vencido" && b.doc_status === "vencido") return 1;
      return (a.expiry_date ?? "").localeCompare(b.expiry_date ?? "");
    });
  }, [critical]);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <FileCheck className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Documentos</h1>
      </div>

      {/* Painel de alertas */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            Alertas críticos ({sortedCritical.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {sortedCritical.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum documento vencido ou próximo de vencer.</p>
          ) : (
            <div className="space-y-2">
              {sortedCritical.slice(0, 20).map((d: any) => {
                const days = d.expiry_date ? differenceInDays(parseISO(d.expiry_date), new Date()) : null;
                const isExpired = d.doc_status === "vencido";
                return (
                  <div
                    key={d.id}
                    className={`flex items-center justify-between p-3 rounded-md border ${
                      isExpired ? "bg-red-50 border-red-300" : "bg-amber-50 border-amber-300"
                    }`}
                  >
                    <div>
                      <p className="font-medium text-sm">
                        {d.employees?.name ?? "—"}{" "}
                        <span className="text-muted-foreground">({d.employees?.matricula ?? "—"})</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type} · validade{" "}
                        {d.expiry_date ? format(parseISO(d.expiry_date), "dd/MM/yyyy") : "—"}
                      </p>
                    </div>
                    <Badge className={isExpired ? "bg-red-600 text-white" : "bg-amber-500 text-white"}>
                      {isExpired ? `Vencido há ${Math.abs(days ?? 0)} dia(s)` : `Vence em ${days} dia(s)`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Lista de funcionários */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Funcionários</CardTitle>
          <div className="relative mt-2">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou matrícula"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <div className="border rounded-md divide-y">
              {filtered.map((emp) => {
                const c = criticalByEmployee.get(emp.id);
                let badge = (
                  <Badge variant="outline" className="text-muted-foreground">
                    Sem documentos
                  </Badge>
                );
                if (c?.vencido) badge = <Badge className="bg-red-600 text-white">{c.vencido} vencido(s)</Badge>;
                else if (c?.a_vencer) badge = <Badge className="bg-amber-500 text-white">{c.a_vencer} a vencer</Badge>;
                else if (c) badge = <Badge className="bg-green-600 text-white">OK</Badge>;

                const open = expanded === emp.id;
                return (
                  <div key={emp.id}>
                    <button
                      onClick={() => setExpanded(open ? null : emp.id)}
                      className="w-full flex items-center justify-between p-3 hover:bg-muted/50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-2">
                        {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        <span className="font-medium">{emp.name}</span>
                        <span className="text-xs text-muted-foreground">{emp.matricula ?? "—"}</span>
                      </div>
                      {badge}
                    </button>
                    {open && <EmployeeDocsPanel employeeId={emp.id} />}
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <p className="p-6 text-center text-sm text-muted-foreground">Nenhum funcionário encontrado.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
