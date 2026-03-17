import { useState } from "react";
import { Users, Plus, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
      await addMember.mutateAsync({ team_id: addMemberTeamId, employee_id: employeeId });
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

  // Filter employees for the add member dialog
  const currentTeamMemberIds = addMemberTeamId
    ? (teams?.find((t: any) => t.id === addMemberTeamId) as any)?.team_members?.map((m: any) => m.employee_id) || []
    : [];

  const filteredEmployees = (employees || []).filter(
    (e) =>
      !currentTeamMemberIds.includes(e.id) &&
      e.name.toLowerCase().includes(searchEmployee.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Users className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Equipes</h1>
            <p className="text-sm text-muted-foreground">Gestão das equipes de campo e suas composições</p>
          </div>
        </div>
        <Button onClick={() => setShowNewTeam(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Nova Equipe
        </Button>
      </div>

      {/* Teams Grid */}
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
          {teams.map((team: any) => (
            <Card key={team.id} className="relative">
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
              <CardContent>
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  MEMBROS ({team.team_members?.length || 0})
                </p>
                {!team.team_members?.length ? (
                  <p className="text-sm text-muted-foreground italic">Nenhum membro</p>
                ) : (
                  <div className="space-y-2">
                    {team.team_members.map((member: any) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-2 rounded-md bg-muted/50"
                      >
                        <div>
                          <p className="text-sm font-medium">{member.employees?.name}</p>
                          <p className="text-xs text-muted-foreground">{member.employees?.role}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive"
                          onClick={() => handleRemoveMember(member.id)}
                        >
                          <X className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* New Team Dialog */}
      <Dialog open={showNewTeam} onOpenChange={setShowNewTeam}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nova Equipe</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Nome da equipe"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
            />
            <Input
              placeholder="Descrição (opcional)"
              value={newTeamDesc}
              onChange={(e) => setNewTeamDesc(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewTeam(false)}>Cancelar</Button>
            <Button onClick={handleCreateTeam} disabled={!newTeamName.trim()}>Criar Equipe</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Member Dialog - Shows availability */}
      <Dialog open={!!addMemberTeamId} onOpenChange={() => setAddMemberTeamId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar Membro à Equipe</DialogTitle>
          </DialogHeader>
          <Input
            placeholder="Buscar funcionário..."
            value={searchEmployee}
            onChange={(e) => setSearchEmployee(e.target.value)}
          />
          <div className="max-h-80 overflow-y-auto space-y-1">
            {filteredEmployees.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">
                Nenhum funcionário encontrado. Cadastre funcionários no módulo RH.
              </p>
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
