import { useState } from "react";
import { Users, Plus, Trash2, UserPlus, X, Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useTeams, useCreateTeam, useDeleteTeam, useAddTeamMember, useRemoveTeamMember } from "@/hooks/useTeams";
import { useEmployeesWithAbsences } from "@/hooks/useEmployees";
import EmployeeAvailabilityBadge from "@/components/operacional/EmployeeAvailabilityBadge";
import { toast } from "sonner";

export default function Equipes() {
  const { data: teams, isLoading } = useTeams();
  const { data: employees } = useEmployeesWithAbsences();
  const createTeam = useCreateTeam();
  const deleteTeam = useDeleteTeam();
  const addMember = useAddTeamMember();
  const removeMember = useRemoveTeamMember();

  const [showNewTeam, setShowNewTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamDesc, setNewTeamDesc] = useState("");
  const [addMemberTeamId, setAddMemberTeamId] = useState<string | null>(null);
  const [addMemberRole, setAddMemberRole] = useState<string>("auxiliar");
  const [searchEmployee, setSearchEmployee] = useState("");

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

  const currentTeamMemberIds = addMemberTeamId
    ? (teams?.find((t: any) => t.id === addMemberTeamId) as any)?.team_members?.map((m: any) => m.employee_id) || []
    : [];

  const filteredEmployees = (employees || []).filter(
    (e) =>
      !currentTeamMemberIds.includes(e.id) &&
      e.name.toLowerCase().includes(searchEmployee.toLowerCase())
  );

  const getTopografo = (team: any) =>
    team.team_members?.find((m: any) => m.role === "topografo");
  const getAuxiliares = (team: any) =>
    team.team_members?.filter((m: any) => m.role !== "topografo") || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Equipes</h1>
            <p className="text-sm text-muted-foreground">Equipes de campo: 1 topógrafo + até 2 auxiliares</p>
          </div>
        </div>
        <Button onClick={() => setShowNewTeam(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Equipe
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : !teams?.length ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhuma equipe cadastrada. Crie a primeira equipe para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team: any) => {
            const topografo = getTopografo(team);
            const auxiliares = getAuxiliares(team);
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
                  disabled={emp.availability !== "disponivel"}
                  className="flex items-center justify-between w-full p-3 rounded-lg text-left hover:bg-muted/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
