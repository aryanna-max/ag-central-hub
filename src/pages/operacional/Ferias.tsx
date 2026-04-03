import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, Plus, Pencil, Trash2, Palmtree } from "lucide-react";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useEmployees } from "@/hooks/useEmployees";
import { toast } from "sonner";

interface Vacation {
  id: string;
  employee_id: string;
  start_date: string;
  end_date: string;
  notes: string | null;
  created_at: string;
}

function useVacations() {
  return useQuery({
    queryKey: ["employee-vacations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_vacations")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as Vacation[];
    },
  });
}

export default function Ferias() {
  const qc = useQueryClient();
  const { data: vacations = [], isLoading } = useVacations();
  const { data: employees = [] } = useEmployees();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Vacation | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    employee_id: "",
    start_date: null as Date | null,
    end_date: null as Date | null,
    notes: "",
  });

  const activeEmployees = useMemo(
    () => employees.filter((e) => e.status !== "desligado").sort((a, b) => a.name.localeCompare(b.name)),
    [employees],
  );

  const empMap = useMemo(() => {
    const m: Record<string, any> = {};
    employees.forEach((e) => { m[e.id] = e; });
    return m;
  }, [employees]);

  const duration = formData.start_date && formData.end_date
    ? differenceInCalendarDays(formData.end_date, formData.start_date) + 1
    : 0;

  const openNew = () => {
    setEditing(null);
    setFormData({ employee_id: "", start_date: null, end_date: null, notes: "" });
    setShowForm(true);
  };

  const openEdit = (v: Vacation) => {
    setEditing(v);
    setFormData({
      employee_id: v.employee_id,
      start_date: parseISO(v.start_date),
      end_date: parseISO(v.end_date),
      notes: v.notes || "",
    });
    setShowForm(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!formData.employee_id || !formData.start_date || !formData.end_date) throw new Error("Campos obrigatórios");
      if (formData.end_date < formData.start_date) throw new Error("Data fim deve ser >= data início");

      const payload = {
        employee_id: formData.employee_id,
        start_date: format(formData.start_date, "yyyy-MM-dd"),
        end_date: format(formData.end_date, "yyyy-MM-dd"),
        notes: formData.notes || null,
      };

      if (editing) {
        const { error } = await supabase.from("employee_vacations").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("employee_vacations").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-vacations"] });
      setShowForm(false);
      toast.success(editing ? "Férias atualizadas" : "Férias registradas");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_vacations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["employee-vacations"] });
      setDeleteId(null);
      toast.success("Férias excluídas");
    },
    onError: () => toast.error("Erro ao excluir"),
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Palmtree className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Férias</h1>
            <p className="text-sm text-muted-foreground">Controle de períodos de férias dos funcionários</p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2">
          <Plus className="w-4 h-4" /> Registrar férias
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : vacations.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Nenhum registro de férias</CardContent></Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Funcionário</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {vacations.map((v) => {
                  const emp = empMap[v.employee_id];
                  const days = differenceInCalendarDays(parseISO(v.end_date), parseISO(v.start_date)) + 1;
                  const now = new Date();
                  const isActive = now >= parseISO(v.start_date) && now <= parseISO(v.end_date);
                  return (
                    <TableRow key={v.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{emp?.name || "—"}</p>
                          <p className="text-xs text-muted-foreground">{emp?.role || ""}</p>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">{format(parseISO(v.start_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell className="text-sm">{format(parseISO(v.end_date), "dd/MM/yyyy")}</TableCell>
                      <TableCell>
                        <span className="text-sm">{days} dias</span>
                        {isActive && <Badge className="ml-2 bg-amber-100 text-amber-800 border-amber-300 text-xs">Em férias</Badge>}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">{v.notes || "—"}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(v)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(v.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Férias" : "Registrar Férias"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Funcionário *</Label>
              <Select value={formData.employee_id} onValueChange={(v) => setFormData((p) => ({ ...p, employee_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecionar funcionário..." /></SelectTrigger>
                <SelectContent>
                  {activeEmployees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>{e.name} — {e.role}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data início *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.start_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.start_date ? format(formData.start_date, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={formData.start_date || undefined} onSelect={(d) => setFormData((p) => ({ ...p, start_date: d || null }))} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label>Data fim *</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !formData.end_date && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {formData.end_date ? format(formData.end_date, "dd/MM/yyyy") : "Selecionar"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={formData.end_date || undefined} onSelect={(d) => setFormData((p) => ({ ...p, end_date: d || null }))} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {duration > 0 && (
              <Badge variant="secondary" className="text-sm">{duration} dias corridos</Badge>
            )}

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={formData.notes} onChange={(e) => setFormData((p) => ({ ...p, notes: e.target.value }))} rows={2} placeholder="Opcional..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || !formData.employee_id || !formData.start_date || !formData.end_date}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Excluir registro de férias?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Esta ação não pode ser desfeita.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => deleteId && deleteMutation.mutate(deleteId)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Excluindo..." : "Excluir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
