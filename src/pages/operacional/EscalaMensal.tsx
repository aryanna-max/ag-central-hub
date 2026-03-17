import { useState } from "react";
import { CalendarDays, Plus, Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useTeams } from "@/hooks/useTeams";
import { useMonthlySchedules, useCreateMonthlySchedule, useDeleteMonthlySchedule } from "@/hooks/useMonthlySchedules";
import MonthlyCalendarGrid from "@/components/operacional/MonthlyCalendarGrid";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
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
  const [form, setForm] = useState({ team_id: "", obra_id: "", start_date: undefined as Date | undefined, end_date: undefined as Date | undefined });

  const { data: teams } = useTeams();
  const { data: obras } = useQuery({
    queryKey: ["obras"],
    queryFn: async () => {
      const { data, error } = await supabase.from("obras").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: schedules, isLoading } = useMonthlySchedules(month, year);
  const createSchedule = useCreateMonthlySchedule();
  const deleteSchedule = useDeleteMonthlySchedule();

  const handleCreate = () => {
    if (!form.team_id || !form.obra_id || !form.start_date || !form.end_date) return;
    createSchedule.mutate(
      {
        team_id: form.team_id,
        obra_id: form.obra_id,
        start_date: format(form.start_date, "yyyy-MM-dd"),
        end_date: format(form.end_date, "yyyy-MM-dd"),
        month,
        year,
      },
      {
        onSuccess: () => {
          setShowNew(false);
          setForm({ team_id: "", obra_id: "", start_date: undefined, end_date: undefined });
          toast.success("Alocação criada!");
        },
        onError: () => toast.error("Erro ao criar alocação."),
      }
    );
  };

  const prevMonth = () => {
    if (month === 1) { setMonth(12); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const nextMonth = () => {
    if (month === 12) { setMonth(1); setYear(year + 1); }
    else setMonth(month + 1);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <CalendarDays className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Escala Mensal</h1>
            <p className="text-sm text-muted-foreground">Planejamento mensal de alocação de equipes por projeto</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={prevMonth}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-sm font-semibold min-w-[140px] text-center">
            {months[month - 1]} {year}
          </span>
          <Button variant="outline" size="icon" onClick={nextMonth}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button onClick={() => setShowNew(true)} className="gap-2 ml-2">
            <Plus className="w-4 h-4" /> Nova Alocação
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Visão Mensal — {months[month - 1]} {year}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground py-8 text-center">Carregando...</p>
          ) : (
            <MonthlyCalendarGrid month={month} year={year} schedules={(schedules || []) as any} />
          )}
        </CardContent>
      </Card>

      {/* Allocations Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Alocações do Período</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {!schedules?.length ? (
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
                  <TableHead>Período</TableHead>
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
                    <TableCell className="text-sm">
                      {s.start_date && s.end_date
                        ? `${format(new Date(s.start_date + "T12:00:00"), "dd/MM")} — ${format(new Date(s.end_date + "T12:00:00"), "dd/MM/yyyy")}`
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => deleteSchedule.mutate(s.id, { onSuccess: () => toast.success("Removido!") })}
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

      {/* New Allocation Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-lg">
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">Data Início</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.start_date && "text-muted-foreground")}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {form.start_date ? format(form.start_date, "dd/MM/yyyy") : "Selecionar..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.start_date}
                      onSelect={(d) => setForm({ ...form, start_date: d || undefined })}
                      defaultMonth={new Date(year, month - 1)}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Data Fim</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !form.end_date && "text-muted-foreground")}>
                      <CalendarDays className="mr-2 h-4 w-4" />
                      {form.end_date ? format(form.end_date, "dd/MM/yyyy") : "Selecionar..."}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.end_date}
                      onSelect={(d) => setForm({ ...form, end_date: d || undefined })}
                      defaultMonth={new Date(year, month - 1)}
                      disabled={(d) => form.start_date ? d < form.start_date : false}
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button
              onClick={handleCreate}
              disabled={!form.team_id || !form.obra_id || !form.start_date || !form.end_date || createSchedule.isPending}
            >
              Alocar Equipe
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
