import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useCreateMeasurement } from "@/hooks/useMeasurements";
import { useTeams } from "@/hooks/useTeams";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultObraId?: string;
}

function useObras() {
  return useQuery({
    queryKey: ["obras-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("obras")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export default function MeasurementFormDialog({ open, onOpenChange }: Props) {
  const createMeasurement = useCreateMeasurement();
  const { data: teams } = useTeams();
  const { data: obras } = useObras();

  const [form, setForm] = useState({
    codigo_bm: "",
    obra_id: "",
    team_id: "",
    period_start: "",
    period_end: "",
    dias_semana: "",
    valor_diaria_semana: "",
    dias_fds: "",
    valor_diaria_fds: "",
    retencao_pct: "5",
    notes: "",
  });

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
    setForm({ codigo_bm: "", obra_id: "", team_id: "", period_start: "", period_end: "", dias_semana: "", valor_diaria_semana: "", dias_fds: "", valor_diaria_fds: "", retencao_pct: "5", notes: "" });

  const handleSave = async (notify: boolean) => {
    if (!form.codigo_bm || !form.period_start || !form.period_end) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    try {
      await createMeasurement.mutateAsync({
        codigo_bm: form.codigo_bm,
        obra_id: form.obra_id || null,
        team_id: form.team_id || null,
        period_start: form.period_start,
        period_end: form.period_end,
        dias_semana: Number(form.dias_semana) || 0,
        valor_diaria_semana: Number(form.valor_diaria_semana) || 0,
        dias_fds: Number(form.dias_fds) || 0,
        valor_diaria_fds: Number(form.valor_diaria_fds) || 0,
        retencao_pct: Number(form.retencao_pct) || 5,
        status: notify ? "aguardando_nf" : "rascunho",
        notes: form.notes || null,
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
          {/* Código BM */}
          <div>
            <Label>Código BM *</Label>
            <Input placeholder="Ex: FSQ-GTR-009" value={form.codigo_bm} onChange={(e) => set("codigo_bm", e.target.value)} />
          </div>

          {/* Obra e Equipe */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Obra</Label>
              <Select value={form.obra_id} onValueChange={(v) => set("obra_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar obra" /></SelectTrigger>
                <SelectContent>
                  {obras?.map((o) => (
                    <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Equipe</Label>
              <Select value={form.team_id} onValueChange={(v) => set("team_id", v)}>
                <SelectTrigger><SelectValue placeholder="Selecionar equipe" /></SelectTrigger>
                <SelectContent>
                  {teams?.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Período */}
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

          <Separator />

          {/* Diárias */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dias 2ª–6ª</Label>
              <Input type="number" min="0" placeholder="0" value={form.dias_semana} onChange={(e) => set("dias_semana", e.target.value)} />
            </div>
            <div>
              <Label>2ª–6ª R$</Label>
              <Input type="number" min="0" step="0.01" placeholder="0,00" value={form.valor_diaria_semana} onChange={(e) => set("valor_diaria_semana", e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Dias Sáb/Dom/Feriado</Label>
              <Input type="number" min="0" placeholder="0" value={form.dias_fds} onChange={(e) => set("dias_fds", e.target.value)} />
            </div>
            <div>
              <Label>Sáb/Dom/Feriado R$</Label>
              <Input type="number" min="0" step="0.01" placeholder="0,00" value={form.valor_diaria_fds} onChange={(e) => set("valor_diaria_fds", e.target.value)} />
            </div>
          </div>

          {/* Retenção */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Retenção %</Label>
              <Input type="number" min="0" max="100" step="0.1" value={form.retencao_pct} onChange={(e) => set("retencao_pct", e.target.value)} />
            </div>
          </div>

          <Separator />

          {/* Resumo calculado */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Valor Bruto</span>
              <span className="font-medium">{fmt(calc.bruto)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Retenção ({form.retencao_pct || 0}%)</span>
              <span className="text-destructive">– {fmt(calc.retencao)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-semibold">
              <span>Valor NF</span>
              <span>{fmt(calc.nf)}</span>
            </div>
          </div>

          {/* Observações */}
          <div>
            <Label>Observações</Label>
            <Textarea placeholder="Notas adicionais..." value={form.notes} onChange={(e) => set("notes", e.target.value)} />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="secondary" onClick={() => handleSave(false)} disabled={!form.codigo_bm}>
            Salvar Rascunho
          </Button>
          <Button onClick={() => handleSave(true)} disabled={!form.codigo_bm || !form.period_start || !form.period_end}>
            Salvar e Notificar Alcione
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
