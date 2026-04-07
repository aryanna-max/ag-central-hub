import { useState, useMemo } from "react";
import { Users, Plus, Trash2, UserPlus, X, Crown, Car, Filter, Printer, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeams, useCreateTeam, useDeleteTeam, useAddTeamMember, useRemoveTeamMember, useUpdateTeamVehicle, useUpdateTeamProject } from "@/hooks/useTeams";
import { useEmployeesWithAbsences } from "@/hooks/useEmployees";
import { useActiveVehicles } from "@/hooks/useVehicles";
import { useProjects } from "@/hooks/useProjects";
import EmployeeAvailabilityBadge from "@/components/operacional/EmployeeAvailabilityBadge";
import { toast } from "sonner";

export default function Equipes() {
  const { data: teams, isLoading } = useTeams();
  const { data: employees } = useEmployeesWithAbsences();
  const { data: vehicles } = useActiveVehicles();
  const { data: projects } = useProjects();
  const createTeam = useCreateTeam();
  const deleteTeam = useDeleteTeam();
  const addMember = useAddTeamMember();
  const removeMember = useRemoveTeamMember();
  const updateVehicle = useUpdateTeamVehicle();
  const updateProject = useUpdateTeamProject();

  const [showNewTeam, setShowNewTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
  const [addMemberRole, setAddMemberRole] = useState<string>("auxiliar");
  const [searchEmployee, setSearchEmployee] = useState("");

  // Filters
  const [filterSearch, setFilterSearch] = useState("");
  const [filterActive, setFilterActive] = useState("all");

  const filteredTeams = useMemo(() => {
    if (!teams) return [];
    return teams.filter((t: any) => {
      if (filterActive === "active" && !t.is_active) return false;
      if (filterActive === "inactive" && t.is_active) return false;
      if (filterSearch) {
        const q = filterSearch.toLowerCase();
        const memberNames = (t.team_members || []).map((m: any) => m.employees?.name || "").join(" ").toLowerCase();
        if (!t.name.toLowerCase().includes(q) && !memberNames.includes(q)) return false;
      }
      return true;
    });
  }, [teams, filterSearch, filterActive]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    try {
      await createTeam.mutateAsync({ name: newTeamName, description: newTeamDesc || undefined });
      setShowNewTeam(false);
      setNewTeamName("");
      setNewTeamDesc("");
      toast.success("Equipe criada com sucesso!");
    } catch {
      toast.error("Erro ao criar equipe");
    }
  };

  const handleAddMember = async (employeeId: string) => {
    if (!addMemberTeamId) return;
    try {
      await addMember.mutateAsync({ team_id: addMemberTeamId, employee_id: employeeId, role: addMemberRole });
      toast.success("Membro adicionado!");
    } catch {
      toast.error("Erro ao adicionar membro (já está na equipe?)");
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      await removeMember.mutateAsync(memberId);
      toast.success("Membro removido!");
    } catch {
      toast.error("Erro ao remover membro");
    }
  };

  const handleVehicleChange = (teamId: string, vehicleId: string) => {
    updateVehicle.mutate(
      { teamId, vehicleId: vehicleId === "none" ? null : vehicleId },
      {
        onSuccess: () => toast.success("Veículo atualizado!"),
        onError: () => toast.error("Erro ao atualizar veículo"),
      }
    );
  };

  const handleProjectChange = (teamId: string, projectId: string) => {
    updateProject.mutate(
      { teamId, projectId: projectId === "none" ? null : projectId },
      {
        onSuccess: () => toast.success("Projeto padrão atualizado!"),
        onError: () => toast.error("Erro ao atualizar projeto"),
      }
    );
  };

  const currentTeamMemberIds = addMemberTeamId
    ? (teams?.find((t: any) => t.id === addMemberTeamId) as any)?.team_members?.map((m: any) => m.employee_id) || []
    : [];

  const filteredEmployees = (employees || []).filter(
    (e) =>
      e.status !== "desligado" &&
      !currentTeamMemberIds.includes(e.id) &&
      e.name.toLowerCase().includes(searchEmployee.toLowerCase())
  );

  const activeProjects = (projects || []).filter((p: any) => p.is_active !== false);

  const getTopografo = (team: any) =>
    team.team_members?.find((m: any) => m.role === "topografo");
  const getAuxiliares = (team: any) =>
    team.team_members?.filter((m: any) => m.role !== "topografo") || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Equipes</h1>
            <p className="text-sm text-muted-foreground">Equipes de campo: 1 topógrafo + até 2 auxiliares + veículo</p>
            <Badge variant="outline" className="mt-1 text-[10px] text-amber-600 border-amber-300 bg-amber-50">
              ⚠ Equipe é agrupamento temporário para facilitar escala, não vínculo fixo
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => window.print()} className="gap-2">
            <Printer className="w-4 h-4" /> Imprimir
          </Button>
          <Button onClick={() => setShowNewTeam(true)} className="gap-2">
            <Plus className="w-4 h-4" /> Nova Equipe
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar equipe ou membro..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              className="w-60"
            />
            <Select value={filterActive} onValueChange={setFilterActive}>
              <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="active">Ativas</SelectItem>
                <SelectItem value="inactive">Inativas</SelectItem>
              </SelectContent>
            </Select>
            {(filterSearch || filterActive !== "all") && (
              <Button variant="ghost" size="sm" onClick={() => { setFilterSearch(""); setFilterActive("all"); }}>
                Limpar
              </Button>
            )}
            <Badge variant="outline" className="ml-auto">{filteredTeams.length} equipes</Badge>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !filteredTeams.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma equipe encontrada.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredTeams.map((team: any) => {
            const topografo = getTopografo(team);
            const auxiliares = getAuxiliares(team);
            const currentVehicle = team.vehicles;
            const currentProject = team.default_project;
            return (
              <Card key={team.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{team.name}</CardTitle>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setAddMemberTeamId(team.id);
                          setSearchEmployee("");
                          setAddMemberRole(!topografo ? "topografo" : "auxiliar");
                        }}
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("Excluir esta equipe?")) deleteTeam.mutate(team.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {team.description && (
                    <p className="text-sm text-muted-foreground">{team.description}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Topógrafo */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Crown className="w-3 h-3" /> TOPÓGRAFO
                    </p>
                    {topografo ? (
                      <div className="flex items-center justify-between p-2 rounded-md bg-primary/5 border border-primary/20">
                        <div>
                          <p className="text-sm font-bold">{topografo.employees?.name}</p>
                          <p className="text-xs text-muted-foreground">{topografo.employees?.role}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                          onClick={() => handleRemoveMember(topografo.id)}>
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground italic p-2">Sem topógrafo definido</p>
                    )}
                  </div>

                  {/* Auxiliares */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                      AUXILIARES ({auxiliares.length}/2)
                    </p>
                    {auxiliares.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic p-2">Nenhum auxiliar</p>
                    ) : (
                      <div className="space-y-1.5">
                        {auxiliares.map((member: any) => (
                          <div key={member.id} className="flex items-center justify-between p-2 rounded-md bg-muted/50">
                            <div>
                              <p className="text-sm font-medium">{member.employees?.name}</p>
                              <p className="text-xs text-muted-foreground">{member.employees?.role}</p>
                            </div>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                              onClick={() => handleRemoveMember(member.id)}>
                              <X className="w-3 h-3" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Veículo Padrão */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                      <Car className="w-3 h-3" /> VEÍCULO PADRÃO
                    </p>
                    <Select
                      value={(team as any).default_vehicle_id || "none"}
                      onValueChange={(v) => handleVehicleChange(team.id, v)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecionar veículo..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem veículo</SelectItem>
                        {(vehicles || []).map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.model} — {v.plate}
                            {v.status !== "disponivel" && ` (${v.status})`}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {currentVehicle && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Atual: {currentVehicle.model} — {currentVehicle.plate}
                      </p>
                    )}
                  </div>

                  {/* Projeto Padrão */}
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                      <FolderKanban className="w-3 h-3" /> PROJETO PADRÃO
                    </p>
                    <Select
                      value={(team as any).default_project_id || "none"}
                      onValueChange={(v) => handleProjectChange(team.id, v)}
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Selecionar projeto..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sem projeto</SelectItem>
                        {activeProjects.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {currentProject && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Atual: {currentProject.name}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* New Team Dialog */}
      <Dialog open={showNewTeam} onOpenChange={setShowNewTeam}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova Equipe</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input placeholder="Nome da equipe (ex: Equipe 01)" value={newTeamName} onChange={(e) => setNewTeamName(e.target.value)} />
            <Input placeholder="Descrição (opcional)" value={newTeamDesc} onChange={(e) => setNewTeamDesc(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTeam(false)}>Cancelar</Button>
            <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()}>Criar Equipe</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog */}
      <Dialog open={!!addMemberTeamId} onOpenChange={() => setAddMemberTeamId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Membro à Equipe</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <Select value={addMemberRole} onValueChange={setAddMemberRole}>
              <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="topografo">Topógrafo</SelectItem>
                <SelectItem value="auxiliar">Auxiliar</SelectItem>
              </SelectContent>
            </Select>
            <Input placeholder="Buscar funcionário..." value={searchEmployee} onChange={(e) => setSearchEmployee(e.target.value)} className="flex-1" />
          </div>
          <div className="max-h-80 overflow-y-auto space-y-1">
            {filteredEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">Nenhum funcionário encontrado.</p>
            ) : (
              filteredEmployees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => handleAddMember(emp.id)}
                  className="flex items-center justify-between w-full p-3 rounded-lg text-left hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{emp.name}</p>
                    <p className="text-xs text-muted-foreground">{emp.role}</p>
                  </div>
                  <EmployeeAvailabilityBadge availability={emp.availability} />
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
