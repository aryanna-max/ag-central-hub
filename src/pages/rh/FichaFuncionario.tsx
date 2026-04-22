import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronLeft,
  Mail,
  Phone,
  MapPin,
  Building2,
  Calendar,
  AlertTriangle,
  CircleCheck,
  CircleAlert,
  UserMinus,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useEmployees } from "@/hooks/useEmployees";
import { useEmployeeDependents } from "@/hooks/useEmployeeDependents";
import DesligamentoDialog from "@/components/rh/DesligamentoDialog";
import DependentsTab from "@/components/rh/DependentsTab";
import EmployeeCompletudeBadge, {
  calculateCompletude,
} from "@/components/rh/EmployeeCompletudeBadge";

import { useState } from "react";

// =============================================================================
// FichaFuncionario — PR C da Onda 3
// =============================================================================
// Página de detalhe `/rh/funcionarios/:id` com tabs para todos os blocos
// de dados do funcionário (42+ campos Fase 3B + resgate Onda 3 original).
//
// Substitui o dialog simples de edição + serve como hub operacional da Alcione
// para consultar/editar tudo de um funcionário.
// =============================================================================

type Employee = NonNullable<ReturnType<typeof useEmployees>["data"]>[number] & {
  // Campos Fase 3B + Onda 3 resgate (tipos não vêm de types.ts ainda — stale)
  rg?: string | null;
  pis?: string | null;
  ctps_numero?: string | null;
  ctps_serie?: string | null;
  cnh?: string | null;
  cnh_categoria?: string | null;
  cnh_validade?: string | null;
  data_nascimento?: string | null;
  nome_mae?: string | null;
  estado_civil?: string | null;
  genero?: string | null;
  escolaridade?: string | null;
  nacionalidade?: string | null;
  cep?: string | null;
  rua?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  estado?: string | null;
  tipo_contrato?: string | null;
  empresa_contratante?: string | null;
  jornada?: string | null;
  salario_base?: number | null;
  job_role_id?: string | null;
  banco?: string | null;
  agencia?: string | null;
  conta?: string | null;
  tipo_conta?: string | null;
  pix_chave?: string | null;
  transporte_tipo?: string | null;
  vt_isento_desconto?: boolean | null;
  recebe_alelo?: boolean | null;
  alelo_valor_dia?: number | null;
  contato_emergencia_nome?: string | null;
  contato_emergencia_telefone?: string | null;
  contato_emergencia_parentesco?: string | null;
  data_demissao?: string | null;
  motivo_demissao?: string | null;
  termination_type?: string | null;
  aviso_previo_type?: string | null;
  termination_value?: number | null;
  termination_notes?: string | null;
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium mt-0.5">
        {value === null || value === undefined || value === "" ? (
          <span className="text-muted-foreground italic">—</span>
        ) : (
          value
        )}
      </p>
    </div>
  );
}

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return format(new Date(iso + "T12:00:00"), "dd/MM/yyyy", { locale: ptBR });
}

function formatCurrency(v: number | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function FichaFuncionario() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [desligarOpen, setDesligarOpen] = useState(false);

  const { data: employees = [] } = useEmployees();
  const employee = employees.find((e) => e.id === id) as Employee | undefined;

  const { data: dependents = [] } = useEmployeeDependents(id);

  // Documentos
  const { data: documents = [] } = useQuery({
    queryKey: ["employee-documents", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_documents")
        .select("*")
        .eq("employee_id", id!)
        .order("expiry_date", { ascending: true, nullsFirst: false });
      return data ?? [];
    },
  });

  // Férias
  const { data: vacations = [] } = useQuery({
    queryKey: ["employee-vacations", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("employee_vacations")
        .select("*")
        .eq("employee_id", id!)
        .order("start_date", { ascending: false });
      return data ?? [];
    },
  });

  // Histórico de descontos
  const { data: discountReports = [] } = useQuery({
    queryKey: ["employee-discount-reports", id],
    enabled: !!id,
    queryFn: async () => {
      const { data } = await supabase
        .from("monthly_discount_reports")
        .select("*")
        .eq("employee_id", id!)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      return data ?? [];
    },
  });

  const completude = useMemo(() => calculateCompletude(employee), [employee]);

  if (!employee) {
    return (
      <div className="p-6">
        <Button variant="ghost" onClick={() => navigate("/rh/funcionarios")}>
          <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
        </Button>
        <Card className="mt-4">
          <CardContent className="pt-12 pb-12 text-center text-muted-foreground">
            Funcionário não encontrado.
          </CardContent>
        </Card>
      </div>
    );
  }

  const isDesligado = !!employee.data_demissao || employee.status === "desligado";

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/rh/funcionarios")}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{employee.name}</h1>
              {isDesligado && (
                <Badge variant="outline" className="bg-muted text-muted-foreground">
                  Desligado
                </Badge>
              )}
              {employee.status === "ferias" && (
                <Badge className="bg-amber-500 text-white">Em férias</Badge>
              )}
              {employee.status === "licenca" && (
                <Badge className="bg-orange-500 text-white">Licença</Badge>
              )}
              {employee.status === "afastado" && (
                <Badge className="bg-red-600 text-white">Afastado</Badge>
              )}
            </div>
            <div className="text-sm text-muted-foreground mt-1 space-x-2">
              {employee.matricula && <span className="font-mono">{employee.matricula}</span>}
              {employee.role && <span>· {employee.role}</span>}
              {employee.empresa_contratante && (
                <span>· {employee.empresa_contratante === "gonzaga_berlim" ? "Gonzaga e Berlim" : "AG Cartografia"}</span>
              )}
              {employee.tipo_contrato && (
                <span className="uppercase text-xs font-semibold bg-muted px-1.5 py-0.5 rounded">
                  {employee.tipo_contrato}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <EmployeeCompletudeBadge completude={completude} />
          <Button variant="outline" size="sm" onClick={() => setDesligarOpen(true)}>
            <UserMinus className="w-4 h-4 mr-1" />
            {isDesligado ? "Reativar" : "Desligar"}
          </Button>
        </div>
      </div>

      {/* Completude — barra visual */}
      <Card className="bg-muted/30">
        <CardContent className="pt-4 pb-4 flex items-center gap-4">
          <div className="flex-1">
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium">Cadastro completude</span>
              <span className="text-muted-foreground">
                {completude.preenchidos} de {completude.total} campos
              </span>
            </div>
            <Progress value={completude.percentual} className="h-2" />
          </div>
          {completude.camposFaltando.length > 0 && (
            <div className="text-xs text-muted-foreground max-w-md truncate">
              Faltam: {completude.camposFaltando.slice(0, 5).join(", ")}
              {completude.camposFaltando.length > 5 && ` +${completude.camposFaltando.length - 5}`}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="dados" className="w-full">
        <TabsList className="w-full grid grid-cols-5 lg:grid-cols-10 gap-0.5 h-auto p-0.5">
          <TabsTrigger value="dados" className="text-xs">Dados</TabsTrigger>
          <TabsTrigger value="contrato" className="text-xs">Contrato</TabsTrigger>
          <TabsTrigger value="bancario" className="text-xs">Bancário</TabsTrigger>
          <TabsTrigger value="transporte" className="text-xs">Transporte</TabsTrigger>
          <TabsTrigger value="emergencia" className="text-xs">Emergência</TabsTrigger>
          <TabsTrigger value="dependentes" className="text-xs">
            Dependentes {dependents.length > 0 && `(${dependents.length})`}
          </TabsTrigger>
          <TabsTrigger value="documentos" className="text-xs">
            Documentos {documents.length > 0 && `(${documents.length})`}
          </TabsTrigger>
          <TabsTrigger value="ferias" className="text-xs">
            Férias {vacations.length > 0 && `(${vacations.length})`}
          </TabsTrigger>
          <TabsTrigger value="descontos" className="text-xs">
            Descontos {discountReports.length > 0 && `(${discountReports.length})`}
          </TabsTrigger>
          <TabsTrigger value="desligamento" className="text-xs" disabled={!isDesligado}>
            Desligamento
          </TabsTrigger>
        </TabsList>

        {/* TAB 1 — DADOS PESSOAIS */}
        <TabsContent value="dados">
          <Card>
            <CardHeader><CardTitle className="text-lg">Dados pessoais</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Nome completo" value={employee.name} />
              <Field label="CPF" value={employee.cpf} />
              <Field label="RG" value={employee.rg} />
              <Field label="PIS" value={employee.pis} />
              <Field label="Data nascimento" value={formatDate(employee.data_nascimento)} />
              <Field label="Nome da mãe" value={employee.nome_mae} />
              <Field label="Estado civil" value={employee.estado_civil} />
              <Field label="Gênero" value={employee.genero} />
              <Field label="Escolaridade" value={employee.escolaridade} />
              <Field label="Nacionalidade" value={employee.nacionalidade} />
              <Field label="Telefone" value={employee.phone} />
              <Field label="Email" value={employee.email} />
              <div className="col-span-full border-t pt-3 mt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Endereço</p>
              </div>
              <Field label="CEP" value={employee.cep} />
              <Field label="Rua" value={employee.rua} />
              <Field label="Número" value={employee.numero} />
              <Field label="Complemento" value={employee.complemento} />
              <Field label="Bairro" value={employee.bairro} />
              <Field label="Cidade" value={employee.cidade} />
              <Field label="Estado" value={employee.estado} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2 — CONTRATO */}
        <TabsContent value="contrato">
          <Card>
            <CardHeader><CardTitle className="text-lg">Contrato de trabalho</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Matrícula" value={employee.matricula} />
              <Field label="Tipo de contrato" value={employee.tipo_contrato?.toUpperCase()} />
              <Field
                label="Empresa contratante"
                value={
                  employee.empresa_contratante === "gonzaga_berlim"
                    ? "Gonzaga e Berlim (22,5%)"
                    : employee.empresa_contratante === "ag_cartografia"
                      ? "AG Cartografia (16,5%)"
                      : null
                }
              />
              <Field label="Cargo (role)" value={employee.role} />
              <Field label="Jornada" value={employee.jornada} />
              <Field label="Data admissão" value={formatDate(employee.admission_date)} />
              <Field label="Salário base" value={formatCurrency(employee.salario_base)} />
              <div className="col-span-full border-t pt-3 mt-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Documentos CLT</p>
              </div>
              <Field label="CTPS — Número" value={employee.ctps_numero} />
              <Field label="CTPS — Série" value={employee.ctps_serie} />
              <Field label="CNH — Número" value={employee.cnh} />
              <Field label="CNH — Categoria" value={employee.cnh_categoria} />
              <Field label="CNH — Validade" value={formatDate(employee.cnh_validade)} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3 — BANCÁRIO */}
        <TabsContent value="bancario">
          <Card>
            <CardHeader><CardTitle className="text-lg">Dados bancários</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Banco" value={employee.banco} />
              <Field label="Agência" value={employee.agencia} />
              <Field label="Conta" value={employee.conta} />
              <Field label="Tipo de conta" value={employee.tipo_conta} />
              <Field label="Chave PIX" value={employee.pix_chave} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4 — TRANSPORTE + ALELO */}
        <TabsContent value="transporte">
          <Card>
            <CardHeader><CardTitle className="text-lg">Transporte e Alelo</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field
                label="Tipo de transporte"
                value={
                  employee.transporte_tipo === "vt_cartao"
                    ? "Cartão (VT/VEM)"
                    : employee.transporte_tipo === "dinheiro"
                      ? "Dinheiro"
                      : employee.transporte_tipo === "nenhum"
                        ? "Nenhum"
                        : null
                }
              />
              <Field
                label="Isento de desconto 6%"
                value={employee.vt_isento_desconto ? "Sim" : "Não"}
              />
              <Field
                label="Recebe Alelo"
                value={employee.recebe_alelo === false ? "Não" : "Sim"}
              />
              <Field
                label="Valor Alelo/dia"
                value={formatCurrency(employee.alelo_valor_dia ?? 15)}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5 — EMERGÊNCIA */}
        <TabsContent value="emergencia">
          <Card>
            <CardHeader><CardTitle className="text-lg">Contato de emergência</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <Field label="Nome" value={employee.contato_emergencia_nome} />
              <Field label="Telefone" value={employee.contato_emergencia_telefone} />
              <Field label="Parentesco" value={employee.contato_emergencia_parentesco} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 6 — DEPENDENTES */}
        <TabsContent value="dependentes">
          <DependentsTab employeeId={employee.id} />
        </TabsContent>

        {/* TAB 7 — DOCUMENTOS */}
        <TabsContent value="documentos">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Documentos ({documents.length})</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/rh/documentos?emp=${employee.id}`)}
              >
                Gerenciar em /rh/documentos
              </Button>
            </CardHeader>
            <CardContent>
              {documents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum documento cadastrado.
                </p>
              ) : (
                <div className="space-y-2">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between border rounded-lg p-3"
                    >
                      <div>
                        <p className="font-medium text-sm">{doc.doc_type?.toUpperCase()}</p>
                        {doc.expiry_date && (
                          <p className="text-xs text-muted-foreground">
                            Validade: {formatDate(doc.expiry_date)}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          doc.doc_status === "valido"
                            ? "bg-green-50 text-green-700 border-green-300"
                            : doc.doc_status === "proximo_vencer"
                              ? "bg-amber-50 text-amber-700 border-amber-300"
                              : doc.doc_status === "vencido"
                                ? "bg-red-50 text-red-700 border-red-300"
                                : ""
                        }
                      >
                        {doc.doc_status ?? "—"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 8 — FÉRIAS */}
        <TabsContent value="ferias">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Histórico de férias ({vacations.length})</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/rh/ferias")}
              >
                Gerenciar em /rh/ferias
              </Button>
            </CardHeader>
            <CardContent>
              {vacations.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhuma férias registrada.
                </p>
              ) : (
                <div className="space-y-2">
                  {vacations.map((v) => (
                    <div key={v.id} className="border rounded-lg p-3 flex justify-between items-center">
                      <div>
                        <p className="text-sm font-medium">
                          {formatDate(v.start_date)} → {formatDate(v.end_date)}
                        </p>
                        {v.notes && <p className="text-xs text-muted-foreground mt-1">{v.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 9 — DESCONTOS */}
        <TabsContent value="descontos">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Descontos mensais ({discountReports.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {discountReports.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Nenhum relatório de desconto ainda.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {discountReports.map((r) => (
                    <div key={r.id} className="border rounded-lg p-2.5 text-sm flex justify-between">
                      <span className="font-medium">{String(r.month).padStart(2, "0")}/{r.year}</span>
                      <span className="text-muted-foreground">
                        Alelo {formatCurrency(r.alelo_valor_final)} ·
                        VT {formatCurrency(r.vt_valor_final)} ·
                        Total desc. {formatCurrency(r.total_descontos)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 10 — DESLIGAMENTO */}
        <TabsContent value="desligamento">
          <Card>
            <CardHeader><CardTitle className="text-lg">Desligamento</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <Field label="Data de desligamento" value={formatDate(employee.data_demissao)} />
              <Field label="Valor da rescisão" value={formatCurrency(employee.termination_value)} />
              <Field label="Tipo de rescisão" value={employee.termination_type} />
              <Field label="Aviso prévio" value={employee.aviso_previo_type} />
              <div className="col-span-full">
                <Field label="Motivo (livre)" value={employee.motivo_demissao} />
              </div>
              <div className="col-span-full">
                <Field label="Observações" value={employee.termination_notes} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog desligar/reativar */}
      <DesligamentoDialog
        employee={employee}
        open={desligarOpen}
        onOpenChange={setDesligarOpen}
      />
    </div>
  );
}
