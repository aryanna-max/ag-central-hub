import { useState, useMemo } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Users, Loader2 } from "lucide-react";
import { useProjects } from "@/hooks/useProjects";
import { useEmployees } from "@/hooks/useEmployees";
import { useTeams } from "@/hooks/useTeams";
import { useActiveVehicles } from "@/hooks/useVehicles";
import { useAddTeamAssignment, useAddDailyEntry } from "@/hooks/useDailySchedule";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scheduleId: string;
  dateStr: string;
}

export default function AddToScheduleSheet({ open, onOpenChange, scheduleId, dateStr }: Props) {
  const [projectId, setProjectId] = useState("none");
  const [vehicleId, setVehicleId] = useState("none");
  const [selectedEmployees, setSelectedEmployees] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: projects = [] } = useProjects();
  const { data: employees = [] } = useEmployees();
  const { data: teams = [] } = useTeams();
  const { data: vehicles = [] } = useActiveVehicles();
  const addAssignment = useAddTeamAssignment();
  const addEntry = useAddDailyEntry();

  const operationalProjects = useMemo(() =>
    projects.filter(p => p.show_in_operational === true && p.status !== "concluido" && p.status !== "pausado"),
    [projects]
  );

  const filteredEmployees = useMemo(() => {
    if (!search) return employees;
    const q = search.toLowerCase();
    return employees.filter(e => e.name.toLowerCase().includes(q));
  }, [employees, search]);

  const toggleEmployee = (id: string) => {
    setSelectedEmployees(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const loadGroup = (team: any) => {
    const members = team.team_members || [];
    const ids = new Set(selectedEmployees);
    members.forEach((m: any) => ids.add(m.employee_id));
    setSelectedEmployees(ids);
    toast.success(`${members.length} membros de "${team.name}" adicionados`);
  };

  const handleSave = async () => {
    if (selectedEmployees.size === 0) {
      toast.error("Selecione ao menos um funcionário");
      return;
    }
    setSaving(true);
    try {
      // Find or use first team as placeholder
      const firstTeam = teams[0];
      if (!firstTeam) {
        toast.error("Nenhum grupo disponível");
        return;
      }

      const resolvedProjectId = projectId !== "none" ? projectId : undefined;
      const resolvedVehicleId = vehicleId !== "none" ? vehicleId : undefined;

      const assignment = await addAssignment.mutateAsync({
        daily_schedule_id: scheduleId,
        team_id: firstTeam.id,
        project_id: resolvedProjectId,
        vehicle_id: resolvedVehicleId,
        date: dateStr,
      });

      for (const empId of selectedEmployees) {
        await addEntry.mutateAsync({
          daily_schedule_id: scheduleId,
          employee_id: empId,
          team_id: firstTeam.id,
          project_id: resolvedProjectId,
          vehicle_id: resolvedVehicleId,
          daily_team_assignment_id: assignment.id,
        });
      }

      toast.success("Equipe adicionada à escala!");
      setProjectId("none");
      setVehicleId("none");
      setSelectedEmployees(new Set());
      setSearch("");
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl flex flex-col p-0">
        <SheetHeader className="px-5 pt-5 pb-3 border-b">
          <SheetTitle className="text-lg">Adicionar à Escala</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Project */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Projeto</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Selecionar projeto..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Sem projeto —</SelectItem>
                {operationalProjects.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.codigo ? `${p.codigo} — ` : ""}{p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Vehicle */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">Veículo (opcional)</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder="Sem veículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sem veículo</SelectItem>
                {(vehicles || []).map((v: any) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.model} ({v.plate})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick groups */}
          {teams.length > 0 && (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase">Grupos Rápidos</Label>
              <div className="flex flex-wrap gap-2">
                {teams.map((t: any) => (
                  <button
                    key={t.id}
                    onClick={() => loadGroup(t)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary active:scale-95 transition-transform"
                  >
                    <Users className="w-3.5 h-3.5" />
                    {t.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Employee search + list */}
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-muted-foreground uppercase">
              Funcionários ({selectedEmployees.size} selecionados)
            </Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar funcionário..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 h-10"
              />
            </div>
            <div className="max-h-[35vh] overflow-y-auto rounded-lg border divide-y">
              {filteredEmployees.map(emp => (
                <label
                  key={emp.id}
                  className="flex items-center gap-3 px-3 py-3 active:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedEmployees.has(emp.id)}
                    onCheckedChange={() => toggleEmployee(emp.id)}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{emp.name}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">{emp.role}</p>
                  </div>
                  {selectedEmployees.has(emp.id) && (
                    <Badge variant="secondary" className="text-[10px]">✓</Badge>
                  )}
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Save button */}
        <div className="px-5 py-4 border-t bg-background">
          <Button onClick={handleSave} disabled={saving || selectedEmployees.size === 0} className="w-full h-12 text-base gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {saving ? "Salvando..." : `Adicionar ${selectedEmployees.size} à Escala`}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
