import { useState } from "react";
import {
  type CompanyDocumentForm,
  DEFAULT_COMPANY_DOC_FORM,
  useCompanyDocuments,
  useUpsertCompanyDocument,
} from "@/hooks/useCompanyDocuments";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
import { Plus, AlertTriangle, FileText } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO } from "date-fns";
import { DOC_TYPE_LABELS } from "@/hooks/useEmployeeDocuments";
import type { Database } from "@/integrations/supabase/types";

export default function CompanyDocsList() {
  const { data: docs = [], isLoading } = useCompanyDocuments();
  const upsert = useUpsertCompanyDocument();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CompanyDocumentForm>({
    ...DEFAULT_COMPANY_DOC_FORM,
  });

  function openNew() {
    setForm({ ...DEFAULT_COMPANY_DOC_FORM });
    setDialogOpen(true);
  }

  function openEdit(d: (typeof docs)[number]) {
    setForm({
      id: d.id,
      empresa: d.empresa as CompanyDocumentForm["empresa"],
      doc_type: d.doc_type,
      doc_status: d.doc_status,
      issue_date: d.issue_date ?? "",
      expiry_date: d.expiry_date ?? "",
      notes: d.notes ?? "",
    });
    setDialogOpen(true);
  }

  async function handleSave() {
    try {
      await upsert.mutateAsync(form);
      toast.success("Documento salvo");
      setDialogOpen(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao salvar";
      toast.error(msg);
    }
  }

  const vencidos = docs.filter((d) => d.doc_status === "vencido");

  return (
    <div className="space-y-4">
      {vencidos.length > 0 && (
        <Card className="border-red-300 bg-red-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <AlertTriangle className="w-4 h-4" /> URGENTE — {vencidos.length}{" "}
              documento(s) vencido(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {vencidos.map((d) => (
              <div key={d.id}>
                <strong>
                  {DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}
                </strong>{" "}
                ({d.empresa}) — venceu em{" "}
                {d.expiry_date
                  ? format(parseISO(d.expiry_date), "dd/MM/yyyy")
                  : "—"}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end">
        <Button onClick={openNew}>
          <Plus className="w-4 h-4 mr-1" /> Adicionar doc empresa
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : docs.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 flex flex-col items-center text-center gap-2">
            <FileText className="w-8 h-8 text-muted-foreground" />
            <p className="text-sm font-medium">
              Nenhum documento cadastrado
            </p>
            <p className="text-xs text-muted-foreground max-w-md">
              Clique em "Adicionar doc empresa" para registrar PCMSO, PGR,
              alvarás, seguros e demais documentos corporativos das empresas
              emissoras.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Documento</TableHead>
              <TableHead>Emissão</TableHead>
              <TableHead>Validade</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {docs.map((d) => {
              const vencido = d.doc_status === "vencido";
              return (
                <TableRow key={d.id} className={vencido ? "bg-red-50" : ""}>
                  <TableCell className="text-xs">
                    {d.empresa === "gonzaga_berlim"
                      ? "Gonzaga Berlim"
                      : d.empresa === "ag_cartografia"
                        ? "AG Cartografia"
                        : d.empresa}
                  </TableCell>
                  <TableCell className="font-medium">
                    {DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}
                  </TableCell>
                  <TableCell>
                    {d.issue_date
                      ? format(parseISO(d.issue_date), "dd/MM/yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    {d.expiry_date
                      ? format(parseISO(d.expiry_date), "dd/MM/yyyy")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={vencido ? "bg-red-600 text-white" : ""}
                      variant={vencido ? "default" : "outline"}
                    >
                      {d.doc_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openEdit(d)}
                    >
                      Editar
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {form.id ? "Editar documento" : "Novo documento empresa"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Empresa</Label>
              <Select
                value={form.empresa}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    empresa: v as CompanyDocumentForm["empresa"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="gonzaga_berlim">Gonzaga Berlim</SelectItem>
                  <SelectItem value="ag_cartografia">AG Cartografia</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo do documento</Label>
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
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Data emissão</Label>
                <Input
                  type="date"
                  value={form.issue_date}
                  onChange={(e) =>
                    setForm({ ...form, issue_date: e.target.value })
                  }
                />
              </div>
              <div>
                <Label>Data validade</Label>
                <Input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) =>
                    setForm({ ...form, expiry_date: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.doc_status}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    doc_status: v as Database["public"]["Enums"]["doc_status"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="valido">Válido</SelectItem>
                  <SelectItem value="proximo_vencer">
                    Próximo de vencer
                  </SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_analise">Em análise</SelectItem>
                </SelectContent>
              </Select>
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
            <Button onClick={handleSave} disabled={upsert.isPending}>
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
