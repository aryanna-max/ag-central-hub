import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjects, useUpdateProject } from "@/hooks/useProjects";
import { useClients } from "@/hooks/useClients";
import { useEmployees } from "@/hooks/useEmployees";
import { useMeasurements } from "@/hooks/useMeasurements";
import { useProjectServices } from "@/hooks/useProjectServices";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectContacts } from "@/hooks/useProjectContacts";
import { useProjectBenefits, useUpsertProjectBenefits } from "@/hooks/useProjectBenefits";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import DeadlineBadge from "@/components/DeadlineBadge";
import { SERVICE_TYPES } from "@/lib/serviceTypes";
import {
  ArrowLeft, Building2, MapPin, Calendar, DollarSign,
  FileText, Users, Clock, FolderKanban, Receipt,
  AlertTriangle, Briefcase, Pencil, Save, X, Coffee, Utensils,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  EXEC_STATUS_LABELS, EXEC_STATUS_COLORS, EXECUTION_STATUSES,
  PROJECT_STATUS_LABELS, BILLING_LABELS, MEASUREMENT_STATUS_LABELS,
} from "@/lib/statusConstants";

const EXEC_LABELS = EXEC_STATUS_LABELS;
const EXEC_COLORS = EXEC_STATUS_COLORS;
const ALL_EXEC = EXECUTION_STATUSES as unknown as string[];
const STATUS_LABELS = PROJECT_STATUS_LABELS;
const MEAS_STATUS = MEASUREMENT_STATUS_LABELS;

const fmtBRL = (v: number | null) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "—";
const fmtDate = (d: string | null) =>
  d ? format(parseISO(d), "dd/MM/yyyy") : "—";

export default function ProjetoHistorico() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: projects = [] } = useProjects();
  const { data: clients = [] } = useClients();
  const { data: employees = [] } = useEmployees();
  const { data: measurements = [] } = useMeasurements();
  const { data: services = [] } = useProjectServices(projectId || "");
  const updateProject = useUpdateProject();
  const { data: projectContacts = [] } = useProjectContacts(projectId || null);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [editingBenefits, setEditingBenefits] = useState(false);
  const [benefitsForm, setBenefitsForm] = useState<Record<string, any>>({});

  const { data: statusHistory = [] } = useQuery({
    queryKey: ["project-status-history", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase.from("project_status_history").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: projectAlerts = [] } = useQuery({
    queryKey: ["project-alerts", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase.from("alerts").select("*").eq("reference_id", projectId).order("created_at", { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const { data: benefits } = useProjectBenefits(projectId);
  const upsertBenefits = useUpsertProjectBenefits();

  const project = useMemo(() => projects.find((p) => p.id === projectId), [projects, projectId]);
  const client = useMemo(() => clients.find((c) => c.id === project?.client_id), [clients, project]);
  const empMap = useMemo(() => new Map(employees.map((e) => [e.id, e.name])), [employees]);
  const projMeasurements = useMemo(() => measurements.filter((m) => m.project_id === projectId), [measurements, projectId]);

  useEffect(() => {
    if (project) setForm({ ...project });
  }, [project]);

  useEffect(() => {
    if (benefits) {
      setBenefitsForm({ ...benefits });
    } else {
      setBenefitsForm({
        cafe_enabled: false, cafe_value: 0,
        almoco_type: "va_cobre", almoco_diferenca_value: 0,
        jantar_enabled: false, jantar_value: 0,
        hospedagem_enabled: false, hospedagem_type: "empresa_paga", hospedagem_value: 0,
      });
    }
  }, [benefits]);

  const handleSaveBenefits = async () => {
    if (!projectId) return;
    try {
      await upsertBenefits.mutateAsync({ project_id: projectId, ...benefitsForm });
      toast.success("Benefícios de campo salvos");
      setEditingBenefits(false);
    } catch { toast.error("Erro ao salvar benefícios"); }
  };

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Projeto não encontrado.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar
        </Button>
      </div>
    );
  }

  const p = editing ? form : project;
  const responsible = (p as any).responsible_id ? empMap.get((p as any).responsible_id) : p.responsible;
  const totalMeasured = projMeasurements.reduce((s, m) => s + (m.valor_bruto || 0), 0);
  const totalNF = projMeasurements.reduce((s, m) => s + (m.valor_nf || 0), 0);
  const location = [p.cidade, p.estado].filter(Boolean).join("/");
  const address = [p.rua, p.numero, p.bairro].filter(Boolean).join(", ");
  const daysInField = p.field_started_at
    ? differenceInDays(p.field_completed_at ? new Date(p.field_completed_at) : new Date(), new Date(p.field_started_at))
    : null;

  const handleStatusChange = async (newStatus: string) => {
    const prev = project.execution_status;
    if (prev === newStatus) return;
    try {
      await updateProject.mutateAsync({ id: project.id, execution_status: newStatus } as any);
      await supabase.from("project_status_history").insert({
        project_id: project.id, from_status: prev, to_status: newStatus,
        modulo: "projetos", changed_by_id: user?.id || null,
      });
      qc.invalidateQueries({ queryKey: ["project-status-history", projectId] });
      toast.success(`Status → ${EXEC_LABELS[newStatus] || newStatus}`);
    } catch { toast.error("Erro ao alterar status"); }
  };

  const handleSave = async () => {
    try {
      await updateProject.mutateAsync({
        id: project.id,
        name: form.name,
        client_id: form.client_id,
        service: form.service,
        contract_value: form.contract_value,
        responsible_id: form.responsible_id,
        notes: form.notes,
        start_date: form.start_date,
        end_date: form.end_date,
        billing_type: form.billing_type,
        empresa_faturadora: form.empresa_faturadora,
        conta_bancaria: form.conta_bancaria,
        cnpj_tomador: form.cnpj_tomador,
        contato_engenheiro: form.contato_engenheiro,
        contato_financeiro: form.contato_financeiro,
        scope_description: form.scope_description,
        field_deadline: form.field_deadline,
        delivery_deadline: form.delivery_deadline,
        field_days_estimated: form.field_days_estimated,
        delivery_days_estimated: form.delivery_days_estimated,
        referencia_contrato: form.referencia_contrato,
      } as any);
      toast.success("Projeto atualizado");
      setEditing(false);
    } catch { toast.error("Erro ao salvar"); }
  };

  const handleCancel = () => { setForm({ ...project }); setEditing(false); };

  // Helper for editable fields
  const Field = ({ label, field, type = "text", half = false }: { label: string; field: string; type?: string; half?: boolean }) => (
    <div className={half ? "" : ""}>
      <p className="text-xs text-muted-foreground">{label}</p>
      {editing ? (
        <Input
          type={type}
          value={form[field] ?? ""}
          onChange={(e) => setForm({ ...form, [field]: type === "number" ? (e.target.value ? Number(e.target.value) : null) : (e.target.value || null) })}
          className="h-8 text-sm mt-0.5"
        />
      ) : (
        <p className="font-medium text-sm">{type === "date" ? fmtDate(p[field]) : (p[field] ?? "—")}</p>
      )}
    </div>
  );

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1200px] mx-auto">
      {/* ═══ HEADER ═══ */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" className="-ml-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div className="flex gap-2">
            {editing ? (
              <>
                <Button size="sm" variant="outline" onClick={handleCancel}><X className="w-4 h-4 mr-1" /> Cancelar</Button>
                <Button size="sm" onClick={handleSave} disabled={updateProject.isPending}>
                  <Save className="w-4 h-4 mr-1" /> {updateProject.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditing(true)}>
                <Pencil className="w-4 h-4 mr-1" /> Editar
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="font-mono text-sm font-bold">{project.codigo || "—"}</Badge>

              {/* execution_status — SEMPRE editável */}
              <Select value={project.execution_status || ""} onValueChange={handleStatusChange}>
                <SelectTrigger className="h-7 w-auto border-0 p-0 bg-transparent">
                  <Badge className={EXEC_COLORS[project.execution_status || ""] || "bg-muted"}>
                    {EXEC_LABELS[project.execution_status || ""] || project.execution_status || "—"}
                  </Badge>
                </SelectTrigger>
                <SelectContent>
                  {ALL_EXEC.map((s) => (
                    <SelectItem key={s} value={s}>{EXEC_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Badge variant="secondary" className="text-[10px] opacity-60">{STATUS_LABELS[project.status] || project.status}</Badge>
            </div>

            {editing ? (
              <Input value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} className="text-2xl font-bold mt-2 h-auto py-1 px-2" />
            ) : (
              <h1 className="text-2xl font-bold mt-2">{p.name}</h1>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
              {editing ? (
                <Select value={form.client_id || ""} onValueChange={(v) => setForm({ ...form, client_id: v })}>
                  <SelectTrigger className="h-7 text-sm w-[200px]"><SelectValue placeholder="Cliente..." /></SelectTrigger>
                  <SelectContent>
                    {clients.filter((c: any) => c.is_active !== false).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : client ? (
                <span className="flex items-center gap-1"><Building2 className="w-3.5 h-3.5" /> {client.name}</span>
              ) : null}
              {location && <span className="flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {location}</span>}
              {editing ? (
                <Select value={form.service || "none"} onValueChange={(v) => setForm({ ...form, service: v === "none" ? null : v })}>
                  <SelectTrigger className="h-7 text-sm w-[200px]"><SelectValue placeholder="Serviço..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {SERVICE_TYPES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              ) : p.service ? (
                <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" /> {p.service}</span>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ KPIs ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {editing ? (
          <Card><CardContent className="p-3">
            <Label className="text-xs">Valor Contrato (R$)</Label>
            <Input type="number" value={form.contract_value ?? ""} onChange={(e) => setForm({ ...form, contract_value: e.target.value ? Number(e.target.value) : null })} className="h-8 mt-1" />
          </CardContent></Card>
        ) : (
          <InfoCard icon={<DollarSign className="w-5 h-5 text-emerald-600" />} label="Valor Contrato" value={fmtBRL(p.contract_value)} />
        )}
        <InfoCard icon={<Receipt className="w-5 h-5 text-blue-600" />} label="Total Medido" value={fmtBRL(totalMeasured)} />
        <InfoCard icon={<FileText className="w-5 h-5 text-amber-600" />} label="Total NF" value={fmtBRL(totalNF)} />
        <InfoCard icon={<Clock className="w-5 h-5 text-purple-600" />} label="Dias em Campo" value={daysInField != null ? `${daysInField} dias` : "—"} />
      </div>

      {/* ═══ CRONOGRAMA ═══ */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Calendar className="w-4 h-4" /> Cronograma</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Field label="Início" field="start_date" type="date" />
            <Field label="Início Campo" field="field_started_at" type="date" />
            <Field label="Campo Concluído" field="field_completed_at" type="date" />
            <Field label="Entregue em" field="delivered_at" type="date" />
          </div>
          <Separator className="my-3" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <Field label="Prazo Campo" field="field_deadline" type="date" />
            <Field label="Dias Campo (est.)" field="field_days_estimated" type="number" />
            <Field label="Prazo Entrega" field="delivery_deadline" type="date" />
            <Field label="Dias Entrega (est.)" field="delivery_days_estimated" type="number" />
          </div>
          {!editing && (
            <>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">Prazo Campo</p>
                  {p.field_deadline ? (
                    <DeadlineBadge deadline={new Date(p.field_deadline)} started_at={p.field_started_at ? new Date(p.field_started_at) : null} estimated_days={p.field_days_estimated} completed_at={p.field_completed_at ? new Date(p.field_completed_at) : null} label="Campo" />
                  ) : <p className="font-medium">—</p>}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Prazo Entrega</p>
                  {p.delivery_deadline ? (
                    <DeadlineBadge deadline={new Date(p.delivery_deadline)} started_at={p.field_completed_at ? new Date(p.field_completed_at) : null} estimated_days={p.delivery_days_estimated} completed_at={p.delivered_at ? new Date(p.delivered_at) : null} label="Entrega" />
                  ) : <p className="font-medium">—</p>}
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Responsável</p>
                  {editing ? (
                    <Select value={form.responsible_id || ""} onValueChange={(v) => setForm({ ...form, responsible_id: v })}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        {employees.filter((e: any) => e.status !== "desligado").map((e: any) => (
                          <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium">{responsible || "—"}</p>
                  )}
                </div>
              </div>
            </>
          )}
          {editing && (
            <>
              <Separator className="my-3" />
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-xs">Responsável</Label>
                  <Select value={form.responsible_id || ""} onValueChange={(v) => setForm({ ...form, responsible_id: v })}>
                    <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {employees.filter((e: any) => e.status !== "desligado").map((e: any) => (
                        <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ═══ FATURAMENTO ═══ */}
      <Card>
        <CardContent className="p-4">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><DollarSign className="w-4 h-4" /> Faturamento</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Tipo</p>
              {editing ? (
                <Select value={form.billing_type || ""} onValueChange={(v) => setForm({ ...form, billing_type: v })}>
                  <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="entrega_nf">NF na Entrega</SelectItem>
                    <SelectItem value="entrega_recibo">Recibo na Entrega</SelectItem>
                    <SelectItem value="medicao_mensal">Medição Mensal</SelectItem>
                    <SelectItem value="misto">Misto</SelectItem>
                    <SelectItem value="sem_documento">Sem Documento</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">
                  {p.billing_type ? <Badge variant="outline">{BILLING_LABELS[p.billing_type] || p.billing_type}</Badge> : <Badge className="bg-red-100 text-red-800">Não definido</Badge>}
                </p>
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Empresa Faturadora</p>
              {editing ? (
                <Select value={form.empresa_faturadora || "ag_topografia"} onValueChange={(v) => setForm({ ...form, empresa_faturadora: v })}>
                  <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ag_topografia">AG Topografia</SelectItem>
                    <SelectItem value="ag_cartografia">AG Cartografia</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{p.empresa_faturadora || "—"}</p>
              )}
            </div>
            <Field label="CNPJ Tomador" field="cnpj_tomador" />
            <div>
              <p className="text-xs text-muted-foreground">Conta Bancária</p>
              {editing ? (
                <Select value={form.conta_bancaria || ""} onValueChange={(v) => setForm({ ...form, conta_bancaria: v })}>
                  <SelectTrigger className="h-8 text-sm mt-0.5"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Bradesco Gonzaga">Bradesco Gonzaga</SelectItem>
                    <SelectItem value="BB Cartografia">BB Cartografia</SelectItem>
                    <SelectItem value="BB Gonzaga">BB Gonzaga</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p className="font-medium">{p.conta_bancaria || "—"}</p>
              )}
            </div>
          </div>
          <Separator className="my-3" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            <Field label="Contato Engenheiro" field="contato_engenheiro" />
            <Field label="Referência Contrato" field="referencia_contrato" />
          </div>
          {projectContacts.length > 0 && (
            <>
              <Separator className="my-3" />
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Contatos</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                {projectContacts.map((c) => (
                  <div key={c.id}>
                    <p className="text-xs text-muted-foreground capitalize">{c.tipo}</p>
                    <p className="font-medium">{c.nome}{c.telefone ? ` — ${c.telefone}` : ""}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ═══ SERVIÇOS ═══ */}
      {services.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <FolderKanban className="w-4 h-4" /> Serviços ({services.length})
            </h3>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Modo</TableHead>
                    <TableHead className="text-right">Valor</TableHead><TableHead>Início</TableHead><TableHead>Fim</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {services.map((s: any) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.service_type}</TableCell>
                      <TableCell><Badge variant="outline">{s.status}</Badge></TableCell>
                      <TableCell className="text-sm">{s.billing_mode || "—"}</TableCell>
                      <TableCell className="text-right">{fmtBRL(s.contract_value)}</TableCell>
                      <TableCell className="text-sm">{fmtDate(s.start_date)}</TableCell>
                      <TableCell className="text-sm">{fmtDate(s.end_date)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ MEDIÇÕES ═══ */}
      {projMeasurements.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Receipt className="w-4 h-4" /> Medições ({projMeasurements.length})
            </h3>
            <div className="rounded-md border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Código BM</TableHead><TableHead>Período</TableHead><TableHead>Status</TableHead>
                    <TableHead className="text-right">Bruto</TableHead><TableHead className="text-right">NF</TableHead><TableHead>NF Nº</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {projMeasurements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-mono font-medium text-sm">{m.codigo_bm}</TableCell>
                      <TableCell className="text-sm">{fmtDate(m.period_start)} — {fmtDate(m.period_end)}</TableCell>
                      <TableCell><Badge variant="outline">{MEAS_STATUS[m.status] || m.status}</Badge></TableCell>
                      <TableCell className="text-right">{fmtBRL(m.valor_bruto)}</TableCell>
                      <TableCell className="text-right">{fmtBRL(m.valor_nf)}</TableCell>
                      <TableCell className="text-sm">{m.nf_numero || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex gap-6 mt-3 text-sm">
              <div><span className="text-muted-foreground">Total Bruto:</span> <span className="font-semibold">{fmtBRL(totalMeasured)}</span></div>
              <div><span className="text-muted-foreground">Total NF:</span> <span className="font-semibold">{fmtBRL(totalNF)}</span></div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ ALERTAS ═══ */}
      {projectAlerts.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Alertas ({projectAlerts.length})
            </h3>
            <div className="space-y-2">
              {projectAlerts.map((a: any) => (
                <div key={a.id} className={cn(
                  "p-3 rounded-lg border text-sm flex items-start gap-3",
                  a.resolved && "opacity-60",
                  a.priority === "urgente" && "border-red-200 bg-red-50",
                  a.priority === "importante" && "border-amber-200 bg-amber-50",
                )}>
                  <div className="flex-1">
                    <p className="font-medium">{a.message || a.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">{fmtDate(a.created_at)} · {a.resolved ? "resolvido" : "ativo"}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">{a.priority}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ HISTÓRICO DE STATUS ═══ */}
      {statusHistory.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><Clock className="w-4 h-4" /> Histórico de Status</h3>
            <div className="space-y-2">
              {statusHistory.map((h: any) => (
                <div key={h.id} className="flex items-center gap-3 text-sm p-2 rounded-lg hover:bg-muted/50">
                  <div className="w-2 h-2 rounded-full bg-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-muted-foreground">{EXEC_LABELS[h.from_status] || h.from_status || "—"}</span>
                    <span className="mx-2">→</span>
                    <span className="font-medium">{EXEC_LABELS[h.to_status] || STATUS_LABELS[h.to_status] || h.to_status}</span>
                    {h.notes && <p className="text-xs text-muted-foreground mt-0.5">{h.notes}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{fmtDate(h.created_at)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ═══ BENEFÍCIOS DE CAMPO ═══ */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Coffee className="w-4 h-4" /> Benefícios de Campo
            </h3>
            {editingBenefits ? (
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => setEditingBenefits(false)}>
                  <X className="w-3 h-3 mr-1" /> Cancelar
                </Button>
                <Button size="sm" onClick={handleSaveBenefits} disabled={upsertBenefits.isPending}>
                  <Save className="w-3 h-3 mr-1" /> {upsertBenefits.isPending ? "Salvando..." : "Salvar"}
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setEditingBenefits(true)}>
                <Pencil className="w-3 h-3 mr-1" /> Editar
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Café */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <Coffee className="w-3.5 h-3.5 text-amber-600" /> Café
                </span>
                {editingBenefits ? (
                  <Switch
                    checked={!!benefitsForm.cafe_enabled}
                    onCheckedChange={(v) => setBenefitsForm({ ...benefitsForm, cafe_enabled: v })}
                  />
                ) : (
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", benefits?.cafe_enabled ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
                    {benefits?.cafe_enabled ? "Ativo" : "Inativo"}
                  </span>
                )}
              </div>
              {editingBenefits && benefitsForm.cafe_enabled && (
                <div>
                  <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                  <Input type="number" step="0.01" value={benefitsForm.cafe_value || ""} onChange={(e) => setBenefitsForm({ ...benefitsForm, cafe_value: Number(e.target.value) })} className="h-7 text-sm mt-0.5" />
                </div>
              )}
              {!editingBenefits && benefits?.cafe_enabled && (
                <p className="text-xs text-muted-foreground">R$ {(benefits.cafe_value || 0).toFixed(2)}/dia</p>
              )}
            </div>

            {/* Almoço */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-blue-600" /> Almoço
                </span>
                {editingBenefits ? (
                  <Select value={benefitsForm.almoco_type || "va_cobre"} onValueChange={(v) => setBenefitsForm({ ...benefitsForm, almoco_type: v })}>
                    <SelectTrigger className="h-7 w-32 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="va_cobre">VA cobre</SelectItem>
                      <SelectItem value="diferenca">Diferença</SelectItem>
                      <SelectItem value="empresa_paga">Empresa paga</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                    {benefits?.almoco_type === "diferenca" ? "Diferença" : benefits?.almoco_type === "empresa_paga" ? "Empresa paga" : "VA cobre"}
                  </span>
                )}
              </div>
              {editingBenefits && benefitsForm.almoco_type === "diferenca" && (
                <div>
                  <Label className="text-xs text-muted-foreground">Valor diferença (R$)</Label>
                  <Input type="number" step="0.01" value={benefitsForm.almoco_diferenca_value || ""} onChange={(e) => setBenefitsForm({ ...benefitsForm, almoco_diferenca_value: Number(e.target.value) })} className="h-7 text-sm mt-0.5" />
                </div>
              )}
              {!editingBenefits && benefits?.almoco_type === "diferenca" && (
                <p className="text-xs text-muted-foreground">R$ {(benefits.almoco_diferenca_value || 0).toFixed(2)}/dia</p>
              )}
            </div>

            {/* Jantar */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium flex items-center gap-1.5">
                  <Utensils className="w-3.5 h-3.5 text-purple-600" /> Jantar
                </span>
                {editingBenefits ? (
                  <Switch
                    checked={!!benefitsForm.jantar_enabled}
                    onCheckedChange={(v) => setBenefitsForm({ ...benefitsForm, jantar_enabled: v })}
                  />
                ) : (
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", benefits?.jantar_enabled ? "bg-purple-100 text-purple-700" : "bg-muted text-muted-foreground")}>
                    {benefits?.jantar_enabled ? "Ativo" : "Inativo"}
                  </span>
                )}
              </div>
              {editingBenefits && benefitsForm.jantar_enabled && (
                <div>
                  <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                  <Input type="number" step="0.01" value={benefitsForm.jantar_value || ""} onChange={(e) => setBenefitsForm({ ...benefitsForm, jantar_value: Number(e.target.value) })} className="h-7 text-sm mt-0.5" />
                </div>
              )}
              {!editingBenefits && benefits?.jantar_enabled && (
                <p className="text-xs text-muted-foreground">R$ {(benefits.jantar_value || 0).toFixed(2)}/dia</p>
              )}
            </div>

            {/* Hospedagem */}
            <div className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Hospedagem</span>
                {editingBenefits ? (
                  <Switch
                    checked={!!benefitsForm.hospedagem_enabled}
                    onCheckedChange={(v) => setBenefitsForm({ ...benefitsForm, hospedagem_enabled: v })}
                  />
                ) : (
                  <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", benefits?.hospedagem_enabled ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground")}>
                    {benefits?.hospedagem_enabled ? "Ativo" : "Inativo"}
                  </span>
                )}
              </div>
              {editingBenefits && benefitsForm.hospedagem_enabled && (
                <div className="space-y-1.5">
                  <div>
                    <Label className="text-xs text-muted-foreground">Tipo</Label>
                    <Select value={benefitsForm.hospedagem_type || "empresa_paga"} onValueChange={(v) => setBenefitsForm({ ...benefitsForm, hospedagem_type: v })}>
                      <SelectTrigger className="h-7 text-xs mt-0.5"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="empresa_paga">Empresa paga</SelectItem>
                        <SelectItem value="reembolso">Reembolso</SelectItem>
                        <SelectItem value="diaria">Diária fixa</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Valor (R$)</Label>
                    <Input type="number" step="0.01" value={benefitsForm.hospedagem_value || ""} onChange={(e) => setBenefitsForm({ ...benefitsForm, hospedagem_value: Number(e.target.value) })} className="h-7 text-sm mt-0.5" />
                  </div>
                </div>
              )}
              {!editingBenefits && benefits?.hospedagem_enabled && (
                <p className="text-xs text-muted-foreground">R$ {(benefits.hospedagem_value || 0).toFixed(2)}/dia · {benefits.hospedagem_type}</p>
              )}
            </div>
          </div>

          {!benefits && !editingBenefits && (
            <p className="text-xs text-muted-foreground text-center py-1">Nenhum benefício configurado para este projeto.</p>
          )}
        </CardContent>
      </Card>

      {/* ═══ OBSERVAÇÕES ═══ */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-2"><FileText className="w-4 h-4" /> Informações Adicionais</h3>
          {(address || editing) && (
            <div>
              <p className="text-xs text-muted-foreground">Endereço</p>
              {editing ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
                  <Input placeholder="Rua" value={form.rua || ""} onChange={(e) => setForm({ ...form, rua: e.target.value })} className="h-8 text-sm" />
                  <Input placeholder="Número" value={form.numero || ""} onChange={(e) => setForm({ ...form, numero: e.target.value })} className="h-8 text-sm" />
                  <Input placeholder="Bairro" value={form.bairro || ""} onChange={(e) => setForm({ ...form, bairro: e.target.value })} className="h-8 text-sm" />
                  <Input placeholder="Cidade" value={form.cidade || ""} onChange={(e) => setForm({ ...form, cidade: e.target.value })} className="h-8 text-sm" />
                </div>
              ) : (
                <p className="text-sm">{address}{location ? ` — ${location}` : ""}</p>
              )}
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Escopo</p>
            {editing ? (
              <Textarea value={form.scope_description || ""} onChange={(e) => setForm({ ...form, scope_description: e.target.value })} rows={2} className="text-sm mt-0.5" />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{p.scope_description || "—"}</p>
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Observações</p>
            {editing ? (
              <Textarea value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={3} className="text-sm mt-0.5" />
            ) : (
              <p className="text-sm whitespace-pre-wrap">{p.notes || "—"}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        {icon}
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
