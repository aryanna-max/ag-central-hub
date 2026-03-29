import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Plus, Pencil, Trash2, Wrench } from "lucide-react";
import {
  useProjectServices,
  useCreateProjectService,
  useUpdateProjectService,
  useDeleteProjectService,
  syncProjectFromServices,
  type ProjectService,
} from "@/hooks/useProjectServices";
import { toast } from "sonner";

const SERVICE_SUGGESTIONS = [
  "Topografia de Obras",
  "Topografia de Projeto",
  "Levantamento Planialtimétrico",
  "Georreferenciamento",
  "Locação de Obra",
  "Cartografia",
  "Topografia Industrial",
  "Acompanhamento de Obras",
  "Levantamento Cadastral Urbano",
];

const BILLING_MODES = [
  { value: "fixo_mensal", label: "Fixo mensal" },
  { value: "diarias", label: "Por diárias" },
  { value: "esporadico", label: "Esporádico" },
];

const STATUS_OPTIONS = [
  { value: "planejamento", label: "Planejamento" },
  { value: "execucao", label: "Execução" },
  { value: "medicao", label: "Medição" },
  { value: "faturamento", label: "Faturamento" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
];

const STATUS_BADGE: Record<string, string> = {
  planejamento: "bg-muted text-muted-foreground",
  execucao: "bg-blue-100 text-blue-800",
  medicao: "bg-amber-100 text-amber-800",
  faturamento: "bg-orange-100 text-orange-800",
  concluido: "bg-emerald-100 text-emerald-800",
  cancelado: "bg-red-100 text-red-800",
};

const BILLING_LABEL: Record<string, string> = {
  fixo_mensal: "Fixo mensal",
  diarias: "Por diárias",
  esporadico: "Esporádico",
};

interface Props {
  projectId: string;
}

const emptyForm = {
  service_type: "",
  billing_mode: "esporadico",
  contract_value: null as number | null,
  cnpj_tomador: "",
  nf_number: "",
  nf_date: "",
  status: "planejamento",
  start_date: "",
  end_date: "",
  notes: "",
};

function formatCurrency(v: number | null) {
  if (v == null) return "—";
  return `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;
}

function applyCnpjMask(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 14);
  return digits
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export default function ProjectServicesSection({ projectId }: Props) {
  const { data: services = [], isLoading } = useProjectServices(projectId);
  const createService = useCreateProjectService();
  const updateService = useUpdateProjectService();
  const deleteService = useDeleteProjectService();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (s: ProjectService) => {
    setEditingId(s.id);
    setForm({
      service_type: s.service_type,
      billing_mode: s.billing_mode,
      contract_value: s.contract_value,
      cnpj_tomador: s.cnpj_tomador || "",
      nf_number: s.nf_number || "",
      nf_date: s.nf_date || "",
      status: s.status,
      start_date: s.start_date || "",
      end_date: s.end_date || "",
      notes: s.notes || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.service_type.trim()) {
      toast.error("Tipo de serviço é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        project_id: projectId,
        service_type: form.service_type,
        billing_mode: form.billing_mode,
        contract_value: form.contract_value,
        cnpj_tomador: form.cnpj_tomador || null,
        nf_number: form.nf_number || null,
        nf_date: form.nf_date || null,
        status: form.status,
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        notes: form.notes || null,
      };

      if (editingId) {
        await updateService.mutateAsync({ id: editingId, ...payload });
        toast.success("Serviço atualizado");
      } else {
        await createService.mutateAsync(payload as any);
        toast.success("Serviço adicionado");
      }
      await syncProjectFromServices(projectId);
      setDialogOpen(false);
    } catch {
      toast.error("Erro ao salvar serviço");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (s: ProjectService) => {
    if (!confirm(`Excluir serviço "${s.service_type}"?`)) return;
    try {
      await deleteService.mutateAsync({ id: s.id, projectId });
      await syncProjectFromServices(projectId);
      toast.success("Serviço excluído");
    } catch {
      toast.error("Erro ao excluir");
    }
  };

  const totalValue = services.reduce((s, sv) => s + (sv.contract_value || 0), 0);

  return (
    <div className="space-y-3 mt-4">
      <Separator />
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Serviços contratados</h3>
          <Badge variant="outline" className="text-xs">{services.length}</Badge>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={openNew}>
          <Plus className="w-3.5 h-3.5" /> Novo Serviço
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground text-center py-4">Carregando...</p>
      ) : services.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">Nenhum sub-serviço cadastrado.</p>
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tipo de Serviço</TableHead>
                <TableHead>Modalidade</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-[70px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {services.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="text-xs font-medium">{s.service_type}</TableCell>
                  <TableCell className="text-xs">{BILLING_LABEL[s.billing_mode] || s.billing_mode}</TableCell>
                  <TableCell className="text-xs text-right font-semibold">{formatCurrency(s.contract_value)}</TableCell>
                  <TableCell>
                    <Badge className={`text-[10px] ${STATUS_BADGE[s.status] || ""}`}>
                      {STATUS_OPTIONS.find((o) => o.value === s.status)?.label || s.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(s)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => handleDelete(s)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex justify-end text-xs font-semibold text-foreground pr-2">
            Total: {formatCurrency(totalValue)}
          </div>
        </>
      )}

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Tipo de serviço *</Label>
              <Input
                value={form.service_type}
                onChange={(e) => setForm({ ...form, service_type: e.target.value })}
                placeholder="Ex: Topografia de Obras"
                list="service-suggestions"
              />
              <datalist id="service-suggestions">
                {SERVICE_SUGGESTIONS.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Modalidade *</Label>
                <Select value={form.billing_mode} onValueChange={(v) => setForm({ ...form, billing_mode: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_MODES.map((b) => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.contract_value ?? ""}
                  onChange={(e) => setForm({ ...form, contract_value: e.target.value ? Number(e.target.value) : null })}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label>CNPJ Tomador</Label>
              <Input
                value={form.cnpj_tomador}
                onChange={(e) => setForm({ ...form, cnpj_tomador: applyCnpjMask(e.target.value) })}
                placeholder="XX.XXX.XXX/XXXX-XX"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Número da NF</Label>
                <Input value={form.nf_number} onChange={(e) => setForm({ ...form, nf_number: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Data da NF</Label>
                <Input type="date" value={form.nf_date} onChange={(e) => setForm({ ...form, nf_date: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Data início</Label>
                <Input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="space-y-1">
                <Label>Data fim</Label>
                <Input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter className="gap-2 pt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando..." : editingId ? "Atualizar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
