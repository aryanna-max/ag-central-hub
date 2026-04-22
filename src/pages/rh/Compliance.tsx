import { useState, useMemo, useEffect } from "react";
import {
  useComplianceExecutions,
  useGenerateMonthExecutions,
  useCompleteExecution,
  useReopenExecution,
} from "@/hooks/useComplianceTasks";
import { useClients } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, CheckCircle2, RotateCcw, Plus, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, startOfMonth } from "date-fns";
import { DOC_TYPE_LABELS } from "@/hooks/useEmployeeDocuments";
import type { Database } from "@/integrations/supabase/types";

// ============================================================
// ABA 1 — Calendário Mensal
// ============================================================

function CalendarioMensal() {
  const today = new Date();
  const defaultMonth = format(startOfMonth(today), "yyyy-MM-dd");
  const [referenceMonth, setReferenceMonth] = useState(defaultMonth);

  const { data: executions = [], isLoading } = useComplianceExecutions(referenceMonth);
  const generate = useGenerateMonthExecutions();
  const complete = useCompleteExecution();
  const reopen = useReopenExecution();

  const todayDay = today.getDate();
  const sameMonth = referenceMonth === defaultMonth;

  async function handleGenerate() {
    try {
      const r = await generate.mutateAsync(referenceMonth);
      toast.success(`${r.count} tarefas geradas/atualizadas para o mês`);
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao gerar calendário");
    }
  }

  async function handleComplete(id: string) {
    try {
      await complete.mutateAsync({ id, referenceMonth });
      toast.success("Tarefa concluída");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  }

  async function handleReopen(id: string) {
    try {
      await reopen.mutateAsync({ id, referenceMonth });
      toast.success("Tarefa reaberta");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro");
    }
  }

  const completed = (executions as any[]).filter((e) => e.completed_at).length;
  const total = executions.length;

  function handleMonthInputChange(value: string) {
    if (!value) return;
    setReferenceMonth(`${value}-01`);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div>
          <Label>Mês de referência</Label>
          <Input
            type="month"
            value={referenceMonth.slice(0, 7)}
            onChange={(e) => handleMonthInputChange(e.target.value)}
          />
        </div>
        <Button onClick={handleGenerate} disabled={generate.isPending} className="self-end">
          <Plus className="w-4 h-4 mr-1" /> Gerar calendário do mês
        </Button>
        <div className="ml-auto self-end text-sm text-muted-foreground">
          <strong>{completed}</strong> de <strong>{total}</strong> tarefas concluídas
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : executions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhuma execução para este mês. Clique em "Gerar calendário do mês" para criar a partir dos templates.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Dia</TableHead>
              <TableHead>Tarefa</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(executions as any[]).map((ex) => {
              const tpl = ex.monthly_compliance_tasks;
              const due = tpl?.due_day;
              const done = !!ex.completed_at;
              const overdue = sameMonth && due && due < todayDay && !done;
              const rowClass = done ? "bg-green-50" : overdue ? "bg-red-50" : "";
              return (
                <TableRow key={ex.id} className={rowClass}>
                  <TableCell className="font-mono">{due ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {done && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                      <div>
                        <p className="font-medium">{tpl?.title ?? "—"}</p>
                        {tpl?.description && (
                          <p className="text-xs text-muted-foreground">{tpl.description}</p>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{tpl?.clients?.name ?? "—"}</TableCell>
                  <TableCell>
                    {done ? (
                      <Badge className="bg-green-600 text-white">
                        Concluída em {format(parseISO(ex.completed_at), "dd/MM")}
                      </Badge>
                    ) : overdue ? (
                      <Badge className="bg-red-600 text-white">Atrasada</Badge>
                    ) : (
                      <Badge variant="outline">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {done ? (
                      <Button variant="outline" size="sm" onClick={() => handleReopen(ex.id)}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reabrir
                      </Button>
                    ) : (
                      <Button size="sm" onClick={() => handleComplete(ex.id)}>
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Concluído
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
}

// ============================================================
// ABA 2 — Docs da Empresa
// ============================================================

// =============================================================================
// Hooks — company_documents
// =============================================================================
// Schema real: empresa (string), doc_type (enum), doc_status (enum),
//   issue_date, expiry_date, notes, file_url.
// Obs: bug anterior usava doc_name (campo inexistente) — fixado 22/04/2026.
// =============================================================================

type CompanyDocumentForm = {
  id?: string;
  empresa: "gonzaga_berlim" | "ag_cartografia";
  doc_type: Database["public"]["Enums"]["doc_type"];
  doc_status: Database["public"]["Enums"]["doc_status"];
  issue_date: string;
  expiry_date: string;
  notes: string;
};

function useCompanyDocuments() {
  return useQuery({
    queryKey: ["company-documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_documents")
        .select("*")
        .order("expiry_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useUpsertCompanyDocument() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: CompanyDocumentForm) => {
      const payload = {
        empresa: values.empresa,
        doc_type: values.doc_type,
        doc_status: values.doc_status,
        issue_date: values.issue_date || null,
        expiry_date: values.expiry_date || null,
        notes: values.notes || null,
      };
      if (values.id) {
        const { error } = await supabase
          .from("company_documents")
          .update(payload)
          .eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_documents").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["company-documents"] }),
  });
}

const DEFAULT_COMPANY_DOC_FORM: CompanyDocumentForm = {
  empresa: "gonzaga_berlim",
  doc_type: "pcmso",
  doc_status: "pendente",
  issue_date: "",
  expiry_date: "",
  notes: "",
};

function DocsEmpresa() {
  const { data: docs = [], isLoading } = useCompanyDocuments();
  const upsert = useUpsertCompanyDocument();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<CompanyDocumentForm>({ ...DEFAULT_COMPANY_DOC_FORM });

  function openNew() {
    setForm({ ...DEFAULT_COMPANY_DOC_FORM });
    setDialogOpen(true);
  }

  function openEdit(d: typeof docs[number]) {
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
              <AlertTriangle className="w-4 h-4" /> URGENTE — {vencidos.length} documento(s) vencido(s)
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {vencidos.map((d) => (
              <div key={d.id}>
                <strong>{DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type}</strong> ({d.empresa}) — venceu em{" "}
                {d.expiry_date ? format(parseISO(d.expiry_date), "dd/MM/yyyy") : "—"}
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
                  <TableCell>{d.issue_date ? format(parseISO(d.issue_date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell>{d.expiry_date ? format(parseISO(d.expiry_date), "dd/MM/yyyy") : "—"}</TableCell>
                  <TableCell>
                    <Badge className={vencido ? "bg-red-600 text-white" : ""} variant={vencido ? "default" : "outline"}>
                      {d.doc_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(d)}>
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
            <DialogTitle>{form.id ? "Editar documento" : "Novo documento empresa"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Empresa</Label>
              <Select
                value={form.empresa}
                onValueChange={(v) =>
                  setForm({ ...form, empresa: v as CompanyDocumentForm["empresa"] })
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
                  setForm({ ...form, doc_type: v as Database["public"]["Enums"]["doc_type"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
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
                  onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                />
              </div>
              <div>
                <Label>Data validade</Label>
                <Input
                  type="date"
                  value={form.expiry_date}
                  onChange={(e) => setForm({ ...form, expiry_date: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={form.doc_status}
                onValueChange={(v) =>
                  setForm({ ...form, doc_status: v as Database["public"]["Enums"]["doc_status"] })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="valido">Válido</SelectItem>
                  <SelectItem value="proximo_vencer">Próximo de vencer</SelectItem>
                  <SelectItem value="vencido">Vencido</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="em_analise">Em análise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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

// ============================================================
// ABA 3 — Requisitos por Cliente
// ============================================================

// =============================================================================
// Hooks — client_doc_requirements (Fase 2)
// =============================================================================
// Schema (src/integrations/supabase/types.ts):
//   - client_id UUID FK
//   - doc_type public.doc_type (enum)
//   - is_mandatory BOOLEAN
//   - validity_months INT (NÃO days — bug fixado 22/04/2026)
//   - notes TEXT
// =============================================================================

type ClientDocRequirementInput = {
  client_id: string;
  doc_type: Database["public"]["Enums"]["doc_type"];
  is_mandatory: boolean;
  validity_months: number | null;
  notes: string | null;
};

function useClientRequirements(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client-doc-requirements", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) return [];
      const { data, error } = await supabase
        .from("client_doc_requirements")
        .select("*")
        .eq("client_id", clientId)
        .order("doc_type");
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useUpsertRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (values: ClientDocRequirementInput) => {
      const { error } = await supabase.from("client_doc_requirements").insert(values);
      if (error) throw error;
    },
    onSuccess: (_, vars) =>
      qc.invalidateQueries({ queryKey: ["client-doc-requirements", vars.client_id] }),
  });
}

function useDeleteRequirement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; clientId: string }) => {
      const { error } = await supabase.from("client_doc_requirements").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["client-doc-requirements", vars.clientId] }),
  });
}

function RequisitosCliente() {
  const { data: clients = [] } = useClients();
  const [clientId, setClientId] = useState<string>("");
  const { data: reqs = [], isLoading } = useClientRequirements(clientId);
  const upsert = useUpsertRequirement();
  const remove = useDeleteRequirement();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<{
    doc_type: Database["public"]["Enums"]["doc_type"];
    validity_months: string;
    notes: string;
  }>({ doc_type: "aso", validity_months: "", notes: "" });

  async function handleAdd() {
    if (!clientId) return;
    try {
      await upsert.mutateAsync({
        client_id: clientId,
        doc_type: form.doc_type,
        validity_months: form.validity_months ? Number(form.validity_months) : null,
        notes: form.notes || null,
        is_mandatory: true,
      });
      toast.success("Requisito adicionado");
      setDialogOpen(false);
      setForm({ doc_type: "aso", validity_months: "", notes: "" });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao adicionar";
      toast.error(msg);
    }
  }

  async function handleRemove(id: string) {
    try {
      await remove.mutateAsync({ id, clientId });
      toast.success("Requisito removido");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao remover";
      toast.error(msg);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3">
        <div className="flex-1 max-w-md">
          <Label>Cliente</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um cliente" />
            </SelectTrigger>
            <SelectContent>
              {clients.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {clientId && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-1" /> Adicionar requisito
          </Button>
        )}
      </div>

      {!clientId ? (
        <p className="text-sm text-muted-foreground">Selecione um cliente para ver os requisitos.</p>
      ) : isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : reqs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum requisito cadastrado para este cliente.</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tipo</TableHead>
              <TableHead>Validade (meses)</TableHead>
              <TableHead>Observações</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reqs.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{DOC_TYPE_LABELS[r.doc_type] ?? r.doc_type}</TableCell>
                <TableCell>{r.validity_months ?? "—"}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{r.notes ?? "—"}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => handleRemove(r.id)}>
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </Button>
                </TableCell>
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
                  setForm({ ...form, doc_type: v as Database["public"]["Enums"]["doc_type"] })
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
                onChange={(e) => setForm({ ...form, validity_months: e.target.value })}
                placeholder="Ex: 12 (ASO) · 24 (NR-18/NR-35)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Padrões: ASO = 12 · NR-18/NR-35 = 24 · CNH = 60 · vazio = sem vencimento
              </p>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
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

// ============================================================
// PÁGINA PRINCIPAL
// ============================================================

export default function Compliance() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Calendar className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Compliance</h1>
      </div>

      <Tabs defaultValue="calendario">
        <TabsList>
          <TabsTrigger value="calendario">Calendário Mensal</TabsTrigger>
          <TabsTrigger value="empresa">Docs da Empresa</TabsTrigger>
          <TabsTrigger value="requisitos">Requisitos por Cliente</TabsTrigger>
        </TabsList>

        <TabsContent value="calendario" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <CalendarioMensal />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="empresa" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <DocsEmpresa />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="requisitos" className="mt-4">
          <Card>
            <CardContent className="pt-6">
              <RequisitosCliente />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
