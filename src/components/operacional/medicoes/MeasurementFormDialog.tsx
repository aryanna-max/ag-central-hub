import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useCreateMeasurement } from "@/hooks/useMeasurements";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProjectId?: string;
}

function useActiveProjects() {
  return useQuery({
    queryKey: ["projects-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, instrucao_faturamento_variavel")
        .eq("is_active", true)
        .neq("status", "concluido")
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export default function MeasurementFormDialog({ open, onOpenChange, defaultProjectId }: Props) {
  const createMeasurement = useCreateMeasurement();
  const { data: projects } = useActiveProjects();

  const [form, setForm] = useState({
    codigo_bm: "",
    project_id: defaultProjectId || "",
    period_start: "",
    period_end: "",
    dias_semana: "",
    valor_diaria_semana: "",
    dias_fds: "",
    valor_diaria_fds: "",
    retencao_pct: "5",
    notes: "",
    empresa_faturadora: "ag_topografia",
    tipo_documento: "nota_fiscal",
    instrucao_faturamento: "",
    responsavel_cobranca: "",
  });

  const selectedProject = (projects || []).find((p: any) => p.id === form.project_id);
  const needsInstrucao = !!(selectedProject as any)?.instrucao_faturamento_variavel;

  useEffect(() => {
    if (open && defaultProjectId) {
      setForm((p) => ({ ...p, project_id: defaultProjectId }));
    }
  }, [open, defaultProjectId]);

  const set = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));

  const calc = useMemo(() => {
    const ds = Number(form.dias_semana) || 0;
    const vds = Number(form.valor_diaria_semana) || 0;
    const df = Number(form.dias_fds) || 0;
    const vdf = Number(form.valor_diaria_fds) || 0;
    const ret = Number(form.retencao_pct) || 0;
    const bruto = ds * vds + df * vdf;
    const retencao = bruto * ret / 100;
    const nf = bruto - retencao;
    return { bruto, retencao, nf };
  }, [form.dias_semana, form.valor_diaria_semana, form.dias_fds, form.valor_diaria_fds, form.retencao_pct]);

  const resetForm = () =>
    setForm({ codigo_bm: "", project_id: "", period_start: "", period_end: "", dias_semana: "", valor_diaria_semana: "", dias_fds: "", valor_diaria_fds: "", retencao_pct: "5", notes: "", empresa_faturadora: "ag_topografia", tipo_documento: "nota_fiscal", instrucao_faturamento: "", responsavel_cobranca: "" });

  const handleSave = async (notify: boolean) => {
    if (!form.codigo_bm || !form.period_start || !form.period_end) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    if (needsInstrucao && !form.instrucao_faturamento.trim()) {
      toast.error("Instrução de faturamento é obrigatória para este projeto");
      return;
    }
    try {
      await createMeasurement.mutateAsync({
        codigo_bm: form.codigo_bm,
        project_id: form.project_id || null,
        period_start: form.period_start,
        period_end: form.period_end,
        dias_semana: Number(form.dias_semana) || 0,
        valor_diaria_semana: Number(form.valor_diaria_semana) || 0,
        dias_fds: Number(form.dias_fds) || 0,
        valor_diaria_fds: Number(form.valor_diaria_fds) || 0,
        retencao_pct: form.tipo_documento === "recibo" ? 0 : (Number(form.retencao_pct) || 5),
        status: notify ? "aguardando_nf" : "rascunho",
        notes: form.notes || null,
        empresa_faturadora: form.empresa_faturadora,
        tipo_documento: form.tipo_documento,
        instrucao_faturamento: form.instrucao_faturamento || null,
        responsavel_cobranca_id: form.responsavel_cobranca || null,
      });

      if (notify) {
        await supabase.from("alerts").insert({
          title: "Medição aguardando NF",
          message: `${form.codigo_bm} — R$ ${calc.nf.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} — Período ${form.period_start} a ${form.period_end}.`,
          alert_type: "medicao_aguardando_nf",
          priority: "importante",
          recipient: "financeiro",
        });
        toast.success("Medição salva e Alcione notificada!");
      } else {
        toast.success("Rascunho salvo!");
      }

      resetForm();
      onOpenChange(false);
    } catch {
      toast.error("Erro ao salvar medição");
    }
  };

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nova Medição</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Código BM *</Label>
            <Input placeholder="Ex: FSQ-GTR-009" value={form.codigo_bm} onChange={(e) => set("codigo_bm", e.target.value)} />
          </div>

          <div>
            <Label>Projeto</Label>
            <Select value={form.project_id} onValueChange={(v) => set("project_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecionar projeto" /></SelectTrigger>
              <SelectContent>
                {(projects || []).map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Período de *</Label>
              <Input type="date" value={form.period_start} onChange={(e) => set("period_start", e.target.value)} />
            </div>
            <div>
              <Label>Período até *</Label>
              <Input type="date" value={form.period_end} onChange={(e) => set("period_end", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Empresa Faturadora</Label>
              <Select value={form.empresa_faturadora} onValueChange={(v) => set("empresa_faturadora", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ag_topografia">AG Topografia e Construções</SelectItem>
                  <SelectItem value="ag_cartografia">AG Cartografia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo Documento</Label>
              <Select value={form.tipo_documento} onValueChange={(v) => {
                set("tipo_documento", v);
                if (v === "recibo") set("retencao_pct", "0");
              }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="nota_fiscal">Nota Fiscal</SelectItem>
                  <SelectItem value="recibo">Recibo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dias Semana</Label>
              <Input type="number" value={form.dias_semana} onChange={(e) => set("dias_semana", e.target.value)} />
            </div>
            <div>
              <Label>Valor Diária Semana</Label>
              <Input type="number" value={form.valor_diaria_semana} onChange={(e) => set("valor_diaria_semana", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dias FDS</Label>
              <Input type="number" value={form.dias_fds} onChange={(e) => set("dias_fds", e.target.value)} />
            </div>
            <div>
              <Label>Valor Diária FDS</Label>
              <Input type="number" value={form.valor_diaria_fds} onChange={(e) => set("valor_diaria_fds", e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Retenção (%)</Label>
            <Input type="number" value={form.retencao_pct} onChange={(e) => set("retencao_pct", e.target.value)} disabled={form.tipo_documento === "recibo"} />
          </div>

          <div className="bg-muted rounded-lg p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Valor Bruto</span><span className="font-semibold">{fmt(calc.bruto)}</span></div>
            <div className="flex justify-between"><span>Retenção</span><span className="font-semibold text-destructive">- {fmt(calc.retencao)}</span></div>
            <Separator />
            <div className="flex justify-between text-base font-bold"><span>Valor NF</span><span className="text-primary">{fmt(calc.nf)}</span></div>
          </div>

          {needsInstrucao && (
            <div>
              <Label>Instrução de Faturamento *</Label>
              <Textarea
                placeholder="Ex: Colorado pediu faturar pelo Colarrio 4 — R$4.800"
                value={form.instrucao_faturamento}
                onChange={(e) => set("instrucao_faturamento", e.target.value)}
                rows={3}
              />
            </div>
          )}

          <div>
            <Label>Responsável pela Cobrança</Label>
            <Select value={form.responsavel_cobranca} onValueChange={(v) => set("responsavel_cobranca", v)}>
              <SelectTrigger><SelectValue placeholder="Opcional" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Marcelo">Marcelo</SelectItem>
                <SelectItem value="Sérgio">Sérgio</SelectItem>
                <SelectItem value="Ciro">Ciro</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Observações</Label>
            <Textarea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </div>
        </div>

        <DialogFooter className="flex gap-2 pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="secondary" onClick={() => handleSave(false)} disabled={createMeasurement.isPending}>Salvar Rascunho</Button>
          <Button onClick={() => handleSave(true)} disabled={createMeasurement.isPending}>Salvar e Notificar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
