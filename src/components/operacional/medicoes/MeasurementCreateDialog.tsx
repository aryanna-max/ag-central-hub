import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCreateMeasurementFromProject } from "@/hooks/useMeasurements";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function useActiveProjects() {
  return useQuery({
    queryKey: ["projects-for-measurement"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, codigo, client_id, clients:client_id(name)")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as any[];
    },
  });
}

export default function MeasurementCreateDialog({ open, onOpenChange }: Props) {
  const { data: projects } = useActiveProjects();
  const createFromProject = useCreateMeasurementFromProject();

  const today = new Date();
  const firstOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-01`;
  const lastOfMonth = (() => {
    const d = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const [projectId, setProjectId] = useState("");
  const [measurementType, setMeasurementType] = useState("grid_diarias");
  const [periodStart, setPeriodStart] = useState(firstOfMonth);
  const [periodEnd, setPeriodEnd] = useState(lastOfMonth);

  const selectedProject = (projects || []).find((p: any) => p.id === projectId);

  const handleCreate = async () => {
    if (!projectId) {
      toast.error("Selecione um projeto");
      return;
    }
    if (!periodStart || !periodEnd) {
      toast.error("Preencha o período inicial e final");
      return;
    }
    if (periodEnd < periodStart) {
      toast.error("Data final deve ser posterior à inicial");
      return;
    }

    try {
      await createFromProject.mutateAsync({
        projectId,
        measurementType,
        periodStart,
        periodEnd,
      });
      toast.success("Medição criada com sucesso!");
      setProjectId("");
      setMeasurementType("grid_diarias");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar medição");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Nova Medição</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>Projeto *</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecionar projeto..." />
              </SelectTrigger>
              <SelectContent>
                {(projects || []).map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo ? `${p.codigo} — ` : ""}{p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedProject && (
            <div className="rounded-lg bg-muted/50 p-3 text-sm space-y-1">
              <p><span className="text-muted-foreground">Cliente:</span> {selectedProject.clients?.name || "—"}</p>
            </div>
          )}

          <div>
            <Label>Tipo de Medição</Label>
            <Select value={measurementType} onValueChange={setMeasurementType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="grid_diarias">Grid Diárias</SelectItem>
                <SelectItem value="boletim_formal">Boletim Formal</SelectItem>
                <SelectItem value="resumo_entrega">Resumo de Entrega</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Período de *</Label>
              <Input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </div>
            <div>
              <Label>Período até *</Label>
              <Input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 p-3 text-sm text-blue-800 dark:text-blue-200">
            O sistema irá automaticamente:
            <ul className="list-disc ml-4 mt-1 space-y-1">
              <li>Puxar client_id e proposal_id do projeto</li>
              <li>Criar itens a partir dos serviços do projeto</li>
              <li>Gerar código BM-{selectedProject?.codigo?.replace(/^\d{4}-/, "") || "XXX"}-NN</li>
              <li>Calcular acumulado de medições anteriores</li>
            </ul>
          </div>
        </div>

        <DialogFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={createFromProject.isPending}>
            {createFromProject.isPending ? "Criando..." : "Criar Medição"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
