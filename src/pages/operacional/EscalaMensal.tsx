import { useState } from "react";
import { CalendarDays, Plus, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useTeams } from "@/hooks/useTeams";
import { toast } from "sonner";

const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export default function EscalaMensal() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ team_id: "", obra_id: "" });
  const qc = useQueryClient();

  const { data: teams } = useTeams();

  const { data: obras } = useQuery({
    queryKey: ["obras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: schedules, isLoading } = useQuery({
    queryKey: ["monthly-schedules", month, year],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("monthly_schedules")
        .select("*, teams(*), obras(*)")
        .eq("month", month)
        .eq("year", year);
      if (error) throw error;
      return data;
    },
  });

  const createSchedule = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("monthly_schedules").insert({
        team_id: form.team_id,
        obra_id: form.obra_id,
        month,
        year,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monthly-schedules"] });
      setShowNew(false);
      setForm({ team_id: "", obra_id: "" });
      toast.success("Escala mensal criada!");
    },
    onError: () => toast.error("Erro ao criar (equipe já alocada neste mês?)"),
  });

  const deleteSchedule = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("monthly_schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["monthly-schedules"] });
      toast.success("Alocação removida!");
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarDays className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Escala Mensal</h1>
            <p className="text-sm text-muted-foreground">Planejamento mensal de alocação de equipes</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
            <SelectContent>
              {months.map((m, i) => (
                <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
            <SelectContent>
              {[2025, 2026, 2027].map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={() => setShowNew(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Alocação
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="p-6 text-muted-foreground">Carregando...</p>
          ) : !schedules?.length ? (
            <p className="p-6 text-center text-muted-foreground">
              Nenhuma alocação para {months[month - 1]} {year}.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Obra/Projeto</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Local</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {schedules.map((s: any) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">
                      <Badge variant="outline">{s.teams?.name}</Badge>
                    </TableCell>
                    <TableCell>{s.obras?.name}</TableCell>
                    <TableCell>{s.obras?.client || "—"}</TableCell>
                    <TableCell>{s.obras?.location || "—"}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deleteSchedule.mutate(s.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Alocação — {months[month - 1]} {year}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Equipe</label>
              <Select value={form.team_id} onValueChange={(v) => setForm({ ...form, team_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar equipe..." /></SelectTrigger>
                <SelectContent>
                  {(teams || []).map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Obra/Projeto</label>
              <Select value={form.obra_id} onValueChange={(v) => setForm({ ...form, obra_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecionar obra..." /></SelectTrigger>
                <SelectContent>
                  {(obras || []).map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>{o.name} {o.client ? `(${o.client})` : ""}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={() => createSchedule.mutate()} disabled={!form.team_id || !form.obra_id}>
              Alocar Equipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
