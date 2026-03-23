import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Car, Plus, Trash2, Users } from "lucide-react";
import { useTeams } from "@/hooks/useTeams";
import { useVehicles } from "@/hooks/useVehicles";
import { useEmployees } from "@/hooks/useEmployees";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schedule: {
    id: string;
    team_id: string;
    obra_id?: string;
    project_id?: string;
    vehicle_id?: string | null;
    start_date: string;
    end_date: string;
    teams: { id: string; name: string; team_members?: any[] } | null;
    projects?: { id: string; name: string; client: string | null } | null;
    vehicles?: { id: string; model: string; plate: string } | null;
  } | null;
  day: number;
  month: number;
  year: number;
  onSave: (scheduleId: string, updates: { team_id?: string; project_id?: string; vehicle_id?: string }, scope: "period" | "day", dayDate?: string, memberOverrides?: { additions: string[]; removals: string[] }) => void;
  onDelete?: (scheduleId: string) => void;
  isPending: boolean;
}

export default function MonthlyDayEditDialog({
  open,
  onOpenChange,
  schedule,
  day,
  month,
  year,
  onSave,
  onDelete,
  isPending,
}: Props) {
  const [teamId, setTeamId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [scope, setScope] = useState<"period" | "day">("period");
  const [editMode, setEditMode] = useState<"team" | "members">("team");
  const [memberAdditions, setMemberAdditions] = useState<string[]>([]);
  const [memberRemovals, setMemberRemovals] = useState<string[]>([]);
  const [addingMember, setAddingMember] = useState("");

  const { data: teams } = useTeams();
  const { data: vehicles } = useVehicles();
  const { data: allEmployees } = useEmployees();
  const { data: projectsList } = useQuery({
    queryKey: ["projects-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (schedule) {
      setTeamId(schedule.team_id);
      setProjectId(schedule.project_id || schedule.obra_id || "");
      setVehicleId(schedule.vehicle_id || "");
      setScope("period");
      setEditMode("team");
      setMemberAdditions([]);
      setMemberRemovals([]);
      setAddingMember("");
    }
  }, [schedule]);

  if (!schedule) return null;

  const dateStr = `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  const targetDate = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const todayStr = new Date().toISOString().slice(0, 10);
  const isPast = targetDate < todayStr;

  const selectedTeam = (teams || []).find((t: any) => t.id === teamId);
  const currentMembers = (selectedTeam as any)?.team_members || [];
  const topografo = currentMembers.find((m: any) => m.role === "topografo");
  const auxiliares = currentMembers.filter((m: any) => m.role !== "topografo");

  const effectiveMembers = currentMembers
    .filter((m: any) => !memberRemovals.includes(m.employee_id))
    .map((m: any) => m.employees);
  const addedEmployees = (allEmployees || []).filter((e: any) => memberAdditions.includes(e.id));

  const currentMemberIds = new Set(currentMembers.map((m: any) => m.employee_id));
  const availableToAdd = (allEmployees || [])
    .filter((e: any) => !currentMemberIds.has(e.id) && !memberAdditions.includes(e.id) && e.status !== "desligado");

  const scheduleProjectId = schedule.project_id || schedule.obra_id || "";

  const hasChanges =
    teamId !== schedule.team_id ||
    projectId !== scheduleProjectId ||
    vehicleId !== (schedule.vehicle_id || "") ||
    memberAdditions.length > 0 ||
    memberRemovals.length > 0;

  const handleSave = () => {
    const updates: { team_id?: string; project_id?: string; vehicle_id?: string } = {};
    if (teamId !== schedule.team_id) updates.team_id = teamId;
    if (projectId !== scheduleProjectId) updates.project_id = projectId;
    if (vehicleId !== (schedule.vehicle_id || "")) updates.vehicle_id = vehicleId;

    const memberOverrides = (memberAdditions.length > 0 || memberRemovals.length > 0)
      ? { additions: memberAdditions, removals: memberRemovals }
      : undefined;

    onSave(schedule.id, updates, scope, targetDate, memberOverrides);
  };

  const handleAddMember = () => {
    if (addingMember && !memberAdditions.includes(addingMember)) {
      setMemberAdditions([...memberAdditions, addingMember]);
      setAddingMember("");
    }
  };

  const handleRemoveMember = (employeeId: string) => {
    if (memberAdditions.includes(employeeId)) {
      setMemberAdditions(memberAdditions.filter(id => id !== employeeId));
    } else {
      setMemberRemovals([...memberRemovals, employeeId]);
    }
  };

  const handleRestoreMember = (employeeId: string) => {
    setMemberRemovals(memberRemovals.filter(id => id !== employeeId));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">
            Editar Alocação — {dateStr}
          </DialogTitle>
        </DialogHeader>

        {isPast && (
          <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 p-2 rounded-md">
            <AlertTriangle className="w-4 h-4" />
            <span>Escalas diárias já confirmadas não serão alteradas.</span>
          </div>
        )}

        {/* Scope selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Escopo da alteração</label>
          <RadioGroup value={scope} onValueChange={(v) => setScope(v as "period" | "day")} className="flex gap-4">
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="period" id="scope-period" />
              <Label htmlFor="scope-period" className="text-sm">Todo o período ({schedule.start_date} → {schedule.end_date})</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="day" id="scope-day" />
              <Label htmlFor="scope-day" className="text-sm">Apenas {dateStr}</Label>
            </div>
          </RadioGroup>
        </div>

        <Tabs value={editMode} onValueChange={(v) => setEditMode(v as "team" | "members")} className="w-full">
          <TabsList className="w-full">
            <TabsTrigger value="team" className="flex-1">Trocar Equipe/Projeto</TabsTrigger>
            <TabsTrigger value="members" className="flex-1">Editar Membros</TabsTrigger>
          </TabsList>

          <TabsContent value="team" className="space-y-4 mt-4">
            {/* Equipe */}
            <div>
              <label className="text-sm font-medium mb-1 block">Equipe</label>
              <Select value={teamId} onValueChange={setTeamId}>
                <SelectTrigger><SelectValue placeholder="Selecionar equipe..." /></SelectTrigger>
                <SelectContent>
                  {(teams || []).map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Team composition preview */}
            {selectedTeam && (
              <div className="border border-border rounded-md p-2 space-y-1">
                <p className="text-xs text-muted-foreground">Composição da equipe:</p>
                <p className="text-sm">
                  <span className="font-bold">Topógrafo:</span>{" "}
                  {topografo?.employees?.name || "—"}
                </p>
                {auxiliares.length > 0 && (
                  <p className="text-sm">
                    <span className="font-medium">Auxiliares:</span>{" "}
                    {auxiliares.map((a: any) => a.employees?.name).join(", ")}
                  </p>
                )}
              </div>
            )}

            {/* Projeto */}
            <div>
              <label className="text-sm font-medium mb-1 block">Projeto</label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Selecionar projeto..." /></SelectTrigger>
                <SelectContent>
                  {(projectsList || []).map((o: any) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} {o.client ? `(${o.client})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Veículo */}
            <div>
              <label className="text-sm font-medium mb-1 block flex items-center gap-1">
                <Car className="w-4 h-4" /> Veículo
              </label>
              <Select value={vehicleId} onValueChange={setVehicleId}>
                <SelectTrigger><SelectValue placeholder="Selecionar veículo..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem veículo</SelectItem>
                  {(vehicles || []).map((v: any) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.model} — {v.plate}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="members" className="space-y-4 mt-4">
            <p className="text-xs text-muted-foreground">
              {scope === "day"
                ? `Altere a composição da equipe apenas para o dia ${dateStr}.`
                : `Altere a composição da equipe para todo o período.`}
            </p>

            {/* Current members */}
            <div className="space-y-2">
              <p className="text-sm font-medium flex items-center gap-1">
                <Users className="w-4 h-4" /> Membros atuais
              </p>
              {currentMembers.map((m: any) => {
                const isRemoved = memberRemovals.includes(m.employee_id);
                return (
                  <div key={m.id} className={`flex items-center justify-between p-2 rounded-md border ${isRemoved ? 'bg-destructive/10 border-destructive/30' : 'border-border'}`}>
                    <div className="flex items-center gap-2">
                      <Badge variant={m.role === "topografo" ? "default" : "secondary"} className="text-xs">
                        {m.role === "topografo" ? "TOP" : "AUX"}
                      </Badge>
                      <span className={`text-sm ${isRemoved ? 'line-through text-muted-foreground' : ''}`}>
                        {m.employees?.name}
                      </span>
                    </div>
                    {isRemoved ? (
                      <Button variant="ghost" size="sm" onClick={() => handleRestoreMember(m.employee_id)} className="h-7 text-xs">
                        Restaurar
                      </Button>
                    ) : (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveMember(m.employee_id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}

              {/* Added members */}
              {addedEmployees.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between p-2 rounded-md border border-green-300 bg-green-50 dark:bg-green-900/20">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-green-600 text-xs">EXTRA</Badge>
                    <span className="text-sm">{e.name}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleRemoveMember(e.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add member */}
            <div className="flex items-center gap-2">
              <Select value={addingMember} onValueChange={setAddingMember}>
                <SelectTrigger className="flex-1"><SelectValue placeholder="Adicionar funcionário..." /></SelectTrigger>
                <SelectContent>
                  {availableToAdd.map((e: any) => (
                    <SelectItem key={e.id} value={e.id}>{e.name} ({e.role})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button size="icon" variant="outline" onClick={handleAddMember} disabled={!addingMember}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="flex justify-between sm:justify-between">
          {onDelete && (
            <Button
              variant="destructive"
              onClick={() => {
                if (confirm("Tem certeza que deseja excluir esta alocação? Esta ação não pode ser desfeita.")) {
                  onDelete(schedule.id);
                }
              }}
              disabled={isPending}
              className="gap-1 mr-auto"
            >
              <Trash2 className="w-4 h-4" /> Excluir Alocação
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={!hasChanges || isPending}>
              {isPending ? "Salvando..." : scope === "day" ? "Salvar (só este dia)" : "Salvar e Sincronizar"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
