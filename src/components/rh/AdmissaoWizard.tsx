import { useState, useMemo } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { formatCpf, formatCep, formatPhone } from "@/lib/masks";
import { useCepAutofill } from "@/hooks/useCepAutofill";
import { useJobRoles } from "@/hooks/useJobRoles";
import { useCreateEmployee, useEmployees } from "@/hooks/useEmployees";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

// =============================================================================
// AdmissaoWizard — 4 etapas usando schema Fase 3B
// =============================================================================
// Etapa 1: Identificação (name, cpf, rg, pis, matricula, dados pessoais)
// Etapa 2: Endereço (cep + endereço completo)
// Etapa 3: Contrato (admission_date, tipo_contrato, empresa, job_role, salário, jornada)
// Etapa 4: Bancário + Transporte + Emergência (+ CLT fields se aplicável)
// =============================================================================

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Step = 0 | 1 | 2 | 3;

const STEP_LABELS = ["Identificação", "Endereço", "Contrato", "Bancário + Emergência"];

type TransporteTipo = "vt_cartao" | "dinheiro" | "nenhum";
type TipoContrato = "clt" | "prestador" | "estagiario" | "temporario";
type Jornada = "44h" | "36h" | "30h" | "20h" | "escala";
type EmpresaContratante = "gonzaga_berlim" | "ag_cartografia";
type TipoConta = "corrente" | "poupanca";
type EstadoCivil = "solteiro" | "casado" | "divorciado" | "viuvo" | "uniao_estavel";
type Escolaridade = "fundamental" | "medio" | "tecnico" | "superior" | "pos";

const ESCOLARIDADE_LABELS: Record<Escolaridade, string> = {
  fundamental: "Ensino Fundamental",
  medio: "Ensino Médio",
  tecnico: "Técnico",
  superior: "Superior",
  pos: "Pós-graduação",
};

const ALELO_VALOR_PADRAO = 15.0;

function validateMatricula(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  if (/^000\d{3}$/.test(trimmed)) return null;
  if (/^PREST-\d{3}$/.test(trimmed)) return null;
  return "Matrícula deve ser formato 000XXX (CLT) ou PREST-XXX (prestador)";
}

function validateCpf(value: string): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return "CPF deve ter 11 dígitos";
  return null;
}

export default function AdmissaoWizard({ open, onOpenChange }: Props) {
  const createEmp = useCreateEmployee();
  const { data: employees = [] } = useEmployees();
  const { data: jobRoles = [] } = useJobRoles();

  const [step, setStep] = useState<Step>(0);

  // Etapa 1 — Identificação
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [pis, setPis] = useState("");
  const [matricula, setMatricula] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [nomeMae, setNomeMae] = useState("");
  const [estadoCivil, setEstadoCivil] = useState<EstadoCivil | "">("");
  const [genero, setGenero] = useState("");
  const [escolaridade, setEscolaridade] = useState<Escolaridade | "">("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Etapa 2 — Endereço
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  // Etapa 3 — Contrato
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().slice(0, 10));
  const [tipoContrato, setTipoContrato] = useState<TipoContrato>("clt");
  const [empresaContratante, setEmpresaContratante] = useState<EmpresaContratante>("gonzaga_berlim");
  const [jobRoleId, setJobRoleId] = useState("");
  const [jornada, setJornada] = useState<Jornada>("44h");
  const [salarioBase, setSalarioBase] = useState("");

  // Etapa 4 — Bancário + Transporte + Emergência + CLT extras
  const [banco, setBanco] = useState("");
  const [agencia, setAgencia] = useState("");
  const [conta, setConta] = useState("");
  const [tipoConta, setTipoConta] = useState<TipoConta>("corrente");
  const [pixChave, setPixChave] = useState("");
  const [transporteTipo, setTransporteTipo] = useState<TransporteTipo>("vt_cartao");
  const [vtIsento, setVtIsento] = useState(false);
  const [recebeAlelo, setRecebeAlelo] = useState(true);
  const [aleloValorDia, setAleloValorDia] = useState(String(ALELO_VALOR_PADRAO));
  const [emergenciaNome, setEmergenciaNome] = useState("");
  const [emergenciaTelefone, setEmergenciaTelefone] = useState("");
  const [emergenciaParentesco, setEmergenciaParentesco] = useState("");
  const [ctpsNumero, setCtpsNumero] = useState("");
  const [ctpsSerie, setCtpsSerie] = useState("");
  const [cnh, setCnh] = useState("");
  const [cnhCategoria, setCnhCategoria] = useState("");
  const [cnhValidade, setCnhValidade] = useState("");

  // CEP autofill
  useCepAutofill(cep, ({ logradouro, bairro: b, cidade: c, estado: e }) => {
    if (logradouro) setRua(logradouro);
    if (b) setBairro(b);
    if (c) setCidade(c);
    if (e) setEstado(e);
  });

  const jobRolesByDept = useMemo(() => {
    const map = new Map<string, typeof jobRoles>();
    for (const jr of jobRoles) {
      if (!map.has(jr.department)) map.set(jr.department, []);
      map.get(jr.department)!.push(jr);
    }
    return map;
  }, [jobRoles]);

  const canProceedFromStep: Record<Step, boolean> = {
    0: !!name.trim() && !validateMatricula(matricula) && !validateCpf(cpf),
    1: true, // endereço opcional
    2: !!admissionDate && !!tipoContrato,
    3: true, // bancário + emergência opcionais
  };

  const resetForm = () => {
    setStep(0);
    setName(""); setCpf(""); setRg(""); setPis(""); setMatricula("");
    setDataNascimento(""); setNomeMae(""); setEstadoCivil(""); setGenero(""); setEscolaridade("");
    setPhone(""); setEmail("");
    setCep(""); setRua(""); setNumero(""); setComplemento(""); setBairro(""); setCidade(""); setEstado("");
    setAdmissionDate(new Date().toISOString().slice(0, 10));
    setTipoContrato("clt"); setEmpresaContratante("gonzaga_berlim");
    setJobRoleId(""); setJornada("44h"); setSalarioBase("");
    setBanco(""); setAgencia(""); setConta(""); setTipoConta("corrente"); setPixChave("");
    setTransporteTipo("vt_cartao"); setVtIsento(false);
    setRecebeAlelo(true); setAleloValorDia(String(ALELO_VALOR_PADRAO));
    setEmergenciaNome(""); setEmergenciaTelefone(""); setEmergenciaParentesco("");
    setCtpsNumero(""); setCtpsSerie(""); setCnh(""); setCnhCategoria(""); setCnhValidade("");
  };

  const handleSubmit = async () => {
    // Validações finais
    if (cpf.trim()) {
      const cpfDigits = cpf.replace(/\D/g, "");
      const existingCpf = employees.find(e => e.cpf?.replace(/\D/g, "") === cpfDigits);
      if (existingCpf) {
        toast.error(`CPF já cadastrado para ${existingCpf.name}`);
        return;
      }
    }

    const selectedJobRole = jobRoles.find(jr => jr.id === jobRoleId);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      cpf: cpf.trim() || null,
      rg: rg.trim() || null,
      pis: pis.trim() || null,
      matricula: matricula.trim().toUpperCase() || null,
      data_nascimento: dataNascimento || null,
      nome_mae: nomeMae.trim() || null,
      estado_civil: estadoCivil || null,
      genero: genero || null,
      escolaridade: escolaridade || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      // Endereço
      cep: cep.trim() || null,
      rua: rua.trim() || null,
      numero: numero.trim() || null,
      complemento: complemento.trim() || null,
      bairro: bairro.trim() || null,
      cidade: cidade.trim() || null,
      estado: estado.trim() || null,
      // Contrato
      admission_date: admissionDate || null,
      tipo_contrato: tipoContrato,
      empresa_contratante: empresaContratante,
      job_role_id: jobRoleId || null,
      role: selectedJobRole?.title || "Ajudante de Topografia", // legacy compat
      jornada,
      salario_base: salarioBase ? parseFloat(salarioBase) : null,
      // Bancário
      banco: banco.trim() || null,
      agencia: agencia.trim() || null,
      conta: conta.trim() || null,
      tipo_conta: tipoConta,
      pix_chave: pixChave.trim() || null,
      // Transporte + Alelo
      transporte_tipo: transporteTipo,
      vt_isento_desconto: vtIsento,
      has_vt: transporteTipo !== "nenhum", // legacy compat
      vt_cash: transporteTipo === "dinheiro", // legacy compat
      recebe_alelo: recebeAlelo,
      alelo_valor_dia: aleloValorDia ? parseFloat(aleloValorDia) : ALELO_VALOR_PADRAO,
      // Emergência
      contato_emergencia_nome: emergenciaNome.trim() || null,
      contato_emergencia_telefone: emergenciaTelefone.trim() || null,
      contato_emergencia_parentesco: emergenciaParentesco.trim() || null,
      // CLT extras
      ctps_numero: ctpsNumero.trim() || null,
      ctps_serie: ctpsSerie.trim() || null,
      cnh: cnh.trim() || null,
      cnh_categoria: cnhCategoria.trim() || null,
      cnh_validade: cnhValidade || null,
      status: "disponivel",
    };

    try {
      await createEmp.mutateAsync(payload as Parameters<typeof createEmp.mutateAsync>[0]);
      toast.success(`${name.trim()} admitido com sucesso!`);
      resetForm();
      onOpenChange(false);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao admitir funcionário";
      toast.error(msg);
    }
  };

  const matriculaError = validateMatricula(matricula);
  const cpfError = validateCpf(cpf);

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Admissão de Funcionário</DialogTitle>
          <div className="flex items-center gap-2 pt-2">
            {STEP_LABELS.map((label, idx) => (
              <div key={idx} className="flex items-center gap-1 flex-1">
                <div
                  className={`flex-1 text-xs font-medium text-center py-1 rounded ${
                    idx === step
                      ? "bg-primary text-primary-foreground"
                      : idx < step
                        ? "bg-green-100 text-green-700"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {idx < step && <Check className="w-3 h-3 inline mr-1" />}
                  {idx + 1}. {label}
                </div>
              </div>
            ))}
          </div>
          <Progress value={((step + 1) / 4) * 100} className="mt-2 h-1" />
        </DialogHeader>

        {/* Etapa 1 — Identificação */}
        {step === 0 && (
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Label>Nome completo *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div>
              <Label>CPF</Label>
              <Input
                value={cpf}
                onChange={(e) => setCpf(formatCpf(e.target.value))}
                placeholder="000.000.000-00"
              />
              {cpfError && <p className="text-xs text-destructive mt-1">{cpfError}</p>}
            </div>
            <div>
              <Label>RG</Label>
              <Input value={rg} onChange={(e) => setRg(e.target.value)} />
            </div>
            <div>
              <Label>PIS</Label>
              <Input value={pis} onChange={(e) => setPis(e.target.value)} />
            </div>
            <div>
              <Label>Matrícula</Label>
              <Input
                value={matricula}
                onChange={(e) => setMatricula(e.target.value.toUpperCase())}
                placeholder="000XXX ou PREST-XXX"
              />
              {matriculaError && <p className="text-xs text-destructive mt-1">{matriculaError}</p>}
            </div>
            <div>
              <Label>Data de nascimento</Label>
              <Input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Nome da mãe</Label>
              <Input value={nomeMae} onChange={(e) => setNomeMae(e.target.value)} placeholder="Obrigatório para CLT" />
            </div>
            <div>
              <Label>Estado civil</Label>
              <Select value={estadoCivil} onValueChange={(v) => setEstadoCivil(v as EstadoCivil)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solteiro">Solteiro(a)</SelectItem>
                  <SelectItem value="casado">Casado(a)</SelectItem>
                  <SelectItem value="divorciado">Divorciado(a)</SelectItem>
                  <SelectItem value="viuvo">Viúvo(a)</SelectItem>
                  <SelectItem value="uniao_estavel">União estável</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Gênero</Label>
              <Input value={genero} onChange={(e) => setGenero(e.target.value)} placeholder="Masculino / Feminino / Outro" />
            </div>
            <div>
              <Label>Escolaridade</Label>
              <Select value={escolaridade} onValueChange={(v) => setEscolaridade(v as Escolaridade)}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ESCOLARIDADE_LABELS) as Escolaridade[]).map((k) => (
                    <SelectItem key={k} value={k}>{ESCOLARIDADE_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Telefone</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                placeholder="(00) 00000-0000"
              />
            </div>
            <div className="col-span-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>
        )}

        {/* Etapa 2 — Endereço */}
        {step === 1 && (
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>CEP</Label>
              <Input
                value={cep}
                onChange={(e) => setCep(formatCep(e.target.value))}
                placeholder="00000-000"
              />
            </div>
            <div className="col-span-2">
              <Label>Rua / Logradouro</Label>
              <Input value={rua} onChange={(e) => setRua(e.target.value)} />
            </div>
            <div>
              <Label>Número</Label>
              <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Complemento</Label>
              <Input value={complemento} onChange={(e) => setComplemento(e.target.value)} />
            </div>
            <div>
              <Label>Bairro</Label>
              <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
            </div>
            <div>
              <Label>Cidade</Label>
              <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
            </div>
            <div>
              <Label>Estado (UF)</Label>
              <Input value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase())} maxLength={2} />
            </div>
          </div>
        )}

        {/* Etapa 3 — Contrato */}
        {step === 2 && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Data de admissão *</Label>
              <Input type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} />
            </div>
            <div>
              <Label>Tipo de contrato *</Label>
              <Select value={tipoContrato} onValueChange={(v) => setTipoContrato(v as TipoContrato)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clt">CLT</SelectItem>
                  <SelectItem value="prestador">Prestador</SelectItem>
                  <SelectItem value="estagiario">Estagiário</SelectItem>
                  <SelectItem value="temporario">Temporário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Empresa contratante *</Label>
              <Select value={empresaContratante} onValueChange={(v) => setEmpresaContratante(v as EmpresaContratante)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gonzaga_berlim">Gonzaga e Berlim (22,5%)</SelectItem>
                  <SelectItem value="ag_cartografia">AG Cartografia (16,5%)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Jornada</Label>
              <Select value={jornada} onValueChange={(v) => setJornada(v as Jornada)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="44h">44h/semana</SelectItem>
                  <SelectItem value="36h">36h/semana</SelectItem>
                  <SelectItem value="30h">30h/semana</SelectItem>
                  <SelectItem value="20h">20h/semana</SelectItem>
                  <SelectItem value="escala">Escala</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Cargo (job role)</Label>
              <Select value={jobRoleId} onValueChange={setJobRoleId}>
                <SelectTrigger><SelectValue placeholder="Selecione o cargo..." /></SelectTrigger>
                <SelectContent>
                  {Array.from(jobRolesByDept.entries()).map(([dept, roles]) => (
                    <div key={dept}>
                      <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
                        {dept.toUpperCase().replace("_", " ")}
                      </div>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.title} {r.cbo_code && <span className="text-xs text-muted-foreground ml-1">({r.cbo_code})</span>}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Salário base (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={salarioBase}
                onChange={(e) => setSalarioBase(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
        )}

        {/* Etapa 4 — Bancário + Transporte + Emergência */}
        {step === 3 && (
          <div className="space-y-4">
            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Dados bancários</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Banco</Label>
                  <Input value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Bradesco / BB / etc" />
                </div>
                <div>
                  <Label>Agência</Label>
                  <Input value={agencia} onChange={(e) => setAgencia(e.target.value)} />
                </div>
                <div>
                  <Label>Conta</Label>
                  <Input value={conta} onChange={(e) => setConta(e.target.value)} />
                </div>
                <div>
                  <Label>Tipo</Label>
                  <Select value={tipoConta} onValueChange={(v) => setTipoConta(v as TipoConta)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Corrente</SelectItem>
                      <SelectItem value="poupanca">Poupança</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2">
                  <Label>Chave PIX</Label>
                  <Input value={pixChave} onChange={(e) => setPixChave(e.target.value)} placeholder="CPF, email, celular ou aleatória" />
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Transporte</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Tipo</Label>
                  <Select value={transporteTipo} onValueChange={(v) => setTransporteTipo(v as TransporteTipo)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="vt_cartao">Cartão (VT/VEM)</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="nenhum">Nenhum</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 mt-7">
                  <Checkbox
                    id="vt-isento"
                    checked={vtIsento}
                    onCheckedChange={(c) => setVtIsento(c === true)}
                  />
                  <Label htmlFor="vt-isento" className="cursor-pointer">Isento de desconto 6%</Label>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Alelo (vale alimentação)</p>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="recebe-alelo"
                  checked={recebeAlelo}
                  onCheckedChange={(c) => setRecebeAlelo(c === true)}
                />
                <Label htmlFor="recebe-alelo" className="cursor-pointer">Recebe Alelo (crédito mensal dia 26)</Label>
              </div>
              {recebeAlelo && (
                <div>
                  <Label>Valor por dia útil (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={aleloValorDia}
                    onChange={(e) => setAleloValorDia(e.target.value)}
                    placeholder={String(ALELO_VALOR_PADRAO)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Padrão R$ {ALELO_VALOR_PADRAO.toFixed(2)}/dia (system_settings.alelo_valor_dia).
                    Sobrescrever só se negociado diferente.
                  </p>
                </div>
              )}
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <p className="text-xs font-semibold text-muted-foreground uppercase">Contato de emergência</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={emergenciaNome} onChange={(e) => setEmergenciaNome(e.target.value)} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <Input
                    value={emergenciaTelefone}
                    onChange={(e) => setEmergenciaTelefone(formatPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
                <div>
                  <Label>Parentesco</Label>
                  <Input value={emergenciaParentesco} onChange={(e) => setEmergenciaParentesco(e.target.value)} placeholder="Esposo(a), Mãe..." />
                </div>
              </div>
            </div>

            {tipoContrato === "clt" && (
              <div className="border rounded-lg p-3 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase">CTPS e CNH (opcionais)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>CTPS número</Label>
                    <Input value={ctpsNumero} onChange={(e) => setCtpsNumero(e.target.value)} />
                  </div>
                  <div>
                    <Label>CTPS série</Label>
                    <Input value={ctpsSerie} onChange={(e) => setCtpsSerie(e.target.value)} />
                  </div>
                  <div>
                    <Label>CNH</Label>
                    <Input value={cnh} onChange={(e) => setCnh(e.target.value)} />
                  </div>
                  <div>
                    <Label>Categoria CNH</Label>
                    <Input value={cnhCategoria} onChange={(e) => setCnhCategoria(e.target.value.toUpperCase())} placeholder="A, B, AB, C, D, E" />
                  </div>
                  <div className="col-span-2">
                    <Label>Validade CNH</Label>
                    <Input type="date" value={cnhValidade} onChange={(e) => setCnhValidade(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="flex-row justify-between gap-2 sm:justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(0, s - 1) as Step)}
            disabled={step === 0 || createEmp.isPending}
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Voltar
          </Button>
          {step < 3 ? (
            <Button
              onClick={() => setStep((s) => Math.min(3, s + 1) as Step)}
              disabled={!canProceedFromStep[step]}
            >
              Próximo
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={createEmp.isPending}>
              {createEmp.isPending ? "Admitindo..." : "Concluir admissão"}
              <Check className="w-4 h-4 ml-1" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
