import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { formatCpf } from "@/lib/masks";
import {
  useEmployeeDependents,
  useCreateDependent,
  useUpdateDependent,
  useDeleteDependent,
  calculateAge,
  countDependentsForIrrf,
  PARENTESCO_LABELS,
  type Parentesco,
  type EmployeeDependent,
} from "@/hooks/useEmployeeDependents";

// =============================================================================
// DependentsTab — CRUD de dependentes de um funcionário (PR C)
// =============================================================================
// Dentro da FichaFuncionario, aba "Dependentes".
// Habilita cálculo correto de IRRF + plano saúde + salário família.
// =============================================================================

type Props = { employeeId: string };

export default function DependentsTab({ employeeId }: Props) {
  const { data: dependents = [], isLoading } = useEmployeeDependents(employeeId);
  const createMut = useCreateDependent();
  const updateMut = useUpdateDependent();
  const deleteMut = useDeleteDependent();

  const [showDialog, setShowDialog] = useState(false);
  const [editing, setEditing] = useState<EmployeeDependent | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<EmployeeDependent | null>(null);

  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [parentesco, setParentesco] = useState<Parentesco>("filho");
  const [isIrrf, setIsIrrf] = useState(false);
  const [isSaude, setIsSaude] = useState(false);
  const [isSalFamilia, setIsSalFamilia] = useState(false);
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (showDialog && editing) {
      setName(editing.name);
      setCpf(editing.cpf ?? "");
      setDataNascimento(editing.data_nascimento ?? "");
      setParentesco(editing.parentesco);
      setIsIrrf(editing.is_dependente_irrf);
      setIsSaude(editing.is_dependente_saude);
      setIsSalFamilia(editing.is_dependente_salario_familia);
      setNotes(editing.notes ?? "");
    } else if (!showDialog) {
      // Reset
      setName(""); setCpf(""); setDataNascimento("");
      setParentesco("filho");
      setIsIrrf(false); setIsSaude(false); setIsSalFamilia(false);
      setNotes("");
      setEditing(null);
    }
  }, [showDialog, editing]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    try {
      const payload = {
        employee_id: employeeId,
        name: name.trim(),
        cpf: cpf.trim() || null,
        data_nascimento: dataNascimento || null,
        parentesco,
        is_dependente_irrf: isIrrf,
        is_dependente_saude: isSaude,
        is_dependente_salario_familia: isSalFamilia,
        notes: notes.trim() || null,
      };
      if (editing) {
        await updateMut.mutateAsync({
          id: editing.id,
          employeeId,
          patch: payload,
        });
        toast.success("Dependente atualizado");
      } else {
        await createMut.mutateAsync(payload);
        toast.success("Dependente adicionado");
      }
      setShowDialog(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error(msg);
    }
  };

  const handleDelete = async () => {
    if (!deleteCandidate) return;
    try {
      await deleteMut.mutateAsync({ id: deleteCandidate.id, employeeId });
      toast.success("Dependente removido");
      setDeleteCandidate(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao remover";
      toast.error(msg);
    }
  };

  const irrfCount = countDependentsForIrrf(dependents);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            Dependentes ({dependents.length})
          </CardTitle>
          {irrfCount > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {irrfCount} elegível{irrfCount > 1 ? "eis" : ""} IRRF · base para dedução fiscal
            </p>
          )}
        </div>
        <Button onClick={() => { setEditing(null); setShowDialog(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
        ) : dependents.length === 0 ? (
          <div className="text-center py-8">
            <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              Nenhum dependente cadastrado.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Adicione para cálculo correto de IRRF, plano saúde e salário família.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {dependents.map((d) => {
              const age = calculateAge(d.data_nascimento);
              return (
                <div key={d.id} className="border rounded-lg p-3 flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{d.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {PARENTESCO_LABELS[d.parentesco]}
                      </Badge>
                      {age !== null && (
                        <span className="text-xs text-muted-foreground">{age} anos</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {d.is_dependente_irrf && (
                        <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-300" variant="outline">
                          IRRF
                        </Badge>
                      )}
                      {d.is_dependente_saude && (
                        <Badge className="text-[10px] bg-green-100 text-green-700 border-green-300" variant="outline">
                          Plano saúde
                        </Badge>
                      )}
                      {d.is_dependente_salario_familia && (
                        <Badge className="text-[10px] bg-purple-100 text-purple-700 border-purple-300" variant="outline">
                          Sal. família
                        </Badge>
                      )}
                      {d.cpf && (
                        <span className="text-[10px] text-muted-foreground font-mono">
                          CPF {d.cpf}
                        </span>
                      )}
                    </div>
                    {d.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{d.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setEditing(d); setShowDialog(true); }}
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => setDeleteCandidate(d)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      {/* Dialog de criação/edição */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Editar dependente" : "Adicionar dependente"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>CPF</Label>
                <Input
                  value={cpf}
                  onChange={(e) => setCpf(formatCpf(e.target.value))}
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <Label>Data nascimento</Label>
                <Input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Parentesco *</Label>
              <Select value={parentesco} onValueChange={(v) => setParentesco(v as Parentesco)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(PARENTESCO_LABELS) as Parentesco[]).map((p) => (
                    <SelectItem key={p} value={p}>{PARENTESCO_LABELS[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="border rounded-lg p-3 space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Elegibilidade</p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is-irrf"
                  checked={isIrrf}
                  onCheckedChange={(c) => setIsIrrf(c === true)}
                />
                <Label htmlFor="is-irrf" className="cursor-pointer text-sm">
                  Dependente IRRF (dedução fiscal)
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is-saude"
                  checked={isSaude}
                  onCheckedChange={(c) => setIsSaude(c === true)}
                />
                <Label htmlFor="is-saude" className="cursor-pointer text-sm">
                  Plano de saúde
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="is-sf"
                  checked={isSalFamilia}
                  onCheckedChange={(c) => setIsSalFamilia(c === true)}
                />
                <Label htmlFor="is-sf" className="cursor-pointer text-sm">
                  Salário família (INSS)
                </Label>
              </div>
            </div>
            <div>
              <Label>Observações</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Opcional — universitário, estudante, etc."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={createMut.isPending || updateMut.isPending}>
              {editing ? "Atualizar" : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteCandidate} onOpenChange={(o) => !o && setDeleteCandidate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover dependente?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteCandidate?.name} será removido. Essa ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
