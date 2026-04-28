import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  useClientRequirements,
  useUpsertRequirement,
  useDeleteRequirement,
} from "@/hooks/useClientRequirements";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DOC_TYPE_LABELS } from "@/hooks/useEmployeeDocuments";
import type { Database } from "@/integrations/supabase/types";
import type { Client } from "@/hooks/useClients";

const EDITABLE_ROLES = ["master", "diretor", "comercial", "financeiro"];

interface RequisitosClienteEditorProps {
  client: Client;
}

type FormState = {
  doc_type: Database["public"]["Enums"]["doc_type"];
  validity_months: string;
  notes: string;
};

const DEFAULT_FORM: FormState = {
  doc_type: "aso",
  validity_months: "",
  notes: "",
};

export default function RequisitosClienteEditor({
  client,
}: RequisitosClienteEditorProps) {
  const { role } = useAuth();
  const canEdit = EDITABLE_ROLES.includes(role ?? "");

  const { data: reqs = [], isLoading } = useClientRequirements(client.id);
  const upsert = useUpsertRequirement();
  const remove = useDeleteRequirement();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>({ ...DEFAULT_FORM });

  async function handleAdd() {
    try {
      await upsert.mutateAsync({
        client_id: client.id,
        doc_type: form.doc_type,
        validity_months: form.validity_months
          ? Number(form.validity_months)
          : null,
        notes: form.notes || null,
        is_mandatory: true,
      });
      toast.success("Requisito adicionado");
      setDialogOpen(false);
      setForm({ ...DEFAULT_FORM });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao adicionar";
      toast.error(msg);
    }
  }

  async function handleRemove(id: string) {
    try {
      await remove.mutateAsync({ id, clientId: client.id });
      toast.success("Requisito removido");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao remover";
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Documentos exigidos para funcionários alocados em projetos deste
          cliente.
        </p>
        {canEdit && (
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar requisito
          </Button>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : reqs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Nenhum requisito cadastrado para este cliente.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Validade (meses)</TableHead>
              <TableHead>Observações</TableHead>
              {canEdit && <TableHead className="text-right">Ações</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {reqs.map((r) => (
              <TableRow key={r.id}>
                <TableCell>
                  {DOC_TYPE_LABELS[r.doc_type] ?? r.doc_type}
                </TableCell>
                <TableCell>{r.validity_months ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {r.notes ?? "—"}
                </TableCell>
                {canEdit && (
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemove(r.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo requisito</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select
                value={form.doc_type}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    doc_type: v as Database["public"]["Enums"]["doc_type"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Validade (meses) — opcional</Label>
              <Input
                type="number"
                value={form.validity_months}
                onChange={(e) =>
                  setForm({ ...form, validity_months: e.target.value })
                }
                placeholder="Ex: 12 (ASO) · 24 (NR-18/NR-35)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Padrões: ASO = 12 · NR-18/NR-35 = 24 · CNH = 60 · vazio = sem
                vencimento
              </p>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAdd} disabled={upsert.isPending}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
