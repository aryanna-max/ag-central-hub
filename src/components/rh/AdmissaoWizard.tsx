import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { ALL_EMPLOYEE_ROLES } from "@/lib/fieldRoles";
import { formatCpf, formatCep, formatPhone } from "@/lib/masks";
import { useCepAutofill } from "@/hooks/useCepAutofill";
import { useCreateEmployee, useEmployees } from "@/hooks/useEmployees";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type Step = 0 | 1 | 2 | 3;

const STEP_LABELS = ["Identificação", "Endereço e Banco", "Contrato", "Benefícios"];

function validateMatricula(value: string): string | null {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  if (/^000\d{3}$/.test(trimmed)) return null;
  if (/^PREST-\d{3}$/.test(trimmed)) return null;
  return "Matrícula deve ser formato 000XXX (CLT) ou PREST-XXX (prestador)";
}

export default function AdmissaoWizard({ open, onOpenChange }: Props) {
  const createEmp = useCreateEmployee();
  const { data: employees = [] } = useEmployees();

  const [step, setStep] = useState<Step>(0);

  // Step 0 — Identificação
  const [name, setName] = useState("");
  const [cpf, setCpf] = useState("");
  const [rg, setRg] = useState("");
  const [matricula, setMatricula] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [nomeMae, setNomeMae] = useState("");
  const [estadoCivil, setEstadoCivil] = useState("");
  const [escolaridade, setEscolaridade] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  // Step 1 — Endereço e Banco
  const [cep, setCep] = useState("");
  const [rua, setRua] = useState("");
  const [numero, setNumero] = useState("");
  const [complemento, setComplemento] = useState("");
  const [bairro, setBairro] = useState("");
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  const [bancoNome, setBancoNome] = useState("");
  const [bancoAgencia, setBancoAgencia] = useState("");
  const [bancoConta, setBancoConta] = useState("");
  const [bancoTipoConta, setBancoTipoConta] = useState("corrente");

  // Step 2 — Contrato
  const [role, setRole] = useState("Ajudante de Topografia");
  const [admissionDate, setAdmissionDate] = useState(new Date().toISOString().slice(0, 10));
  const [tipoContrato, setTipoContrato] = useState("clt");
  const [empresaEmissora, setEmpresaEmissora] = useState("gonzaga_berlim");
  const [salarioBase, setSalarioBase] = useState("");
  const [pis, setPis] = useState("");
  const [ctpsNumero, setCtpsNumero] = useState("");
  const [ctpsSerie, setCtpsSerie] = useState("");

  // Step 3 — Benefícios
  const [recebeAlelo, setRecebeAlelo] = useState(false);
  const [aleloValorDia, setAleloValorDia] = useState("15.00");
  const [hasVt, setHasVt] = useState(false);
  const [vtCash, setVtCash] = useState(false);
  const [vtValue, setVtValue] = useState("");
  const [transporteTipo, setTransporteTipo] = useState("vt_cartao");

  // CEP autofill
  const cepLookup = useCepAutofill(cep);
  useMemo(() => {
    if (cepLookup.rua && !rua) setRua(cepLookup.rua);
    if (cepLookup.bairro && !bairro) setBairro(cepLookup.bairro);
    if (cepLookup.cidade && !cidade) setCidade(cepLookup.cidade);
    if (cepLookup.estado && !estado) setEstado(cepLookup.estado);
  }, [cepLookup.rua, cepLookup.bairro, cepLookup.cidade, cepLookup.estado]);

  const reset = () => {
    setStep(0);
    setName(""); setCpf(""); setRg(""); setMatricula("");
    setDataNascimento(""); setNomeMae(""); setEstadoCivil(""); setEscolaridade("");
    setPhone(""); setEmail("");
    setCep(""); setRua(""); setNumero(""); setComplemento("");
    setBairro(""); setCidade(""); setEstado("");
    setBancoNome(""); setBancoAgencia(""); setBancoConta(""); setBancoTipoConta("corrente");
    setRole("Ajudante de Topografia");
    setAdmissionDate(new Date().toISOString().slice(0, 10));
    setTipoContrato("clt"); setEmpresaEmissora("gonzaga_berlim");
    setSalarioBase(""); setPis(""); setCtpsNumero(""); setCtpsSerie("");
    setRecebeAlelo(false); setAleloValorDia("15.00");
    setHasVt(false); setVtCash(false); setVtValue(""); setTransporteTipo("vt_cartao");
  };

  const canAdvance = () => {
    if (step === 0) return !!name.trim();
    return true;
  };

  const handleNext = () => {
    if (step < 3 && canAdvance()) setStep((s) => (s + 1) as Step);
  };

  const handleBack = () => {
    if (step > 0) setStep((s) => (s - 1) as Step);
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      setStep(0);
      return;
    }
    const matError = validateMatricula(matricula);
    if (matricula && matError) {
      toast.error(matError);
      setStep(0);
      return;
    }
    if (cpf.trim()) {
      const existing = employees.find((e) => e.cpf === cpf.trim());
      if (existing) {
        toast.error(`CPF já cadastrado: ${existing.name}`);
        setStep(0);
        return;
      }
    }

    try {
      // Criar registro basico via hook
      const basic = await createEmp.mutateAsync({
        name: name.trim(),
        cpf: cpf.trim() || null,
        role: role || "Ajudante de Topografia",
        matricula: matricula.trim().toUpperCase() || null,
        admission_date: admissionDate || null,
        status: "disponivel",
        email: email.trim() || null,
        phone: phone.trim() || null,
      } as any);

      // Update com todos os campos novos da Fase 3
      const id = (basic as any)?.id;
      if (id) {
        const extraPatch = {
          rg: rg.trim() || null,
          pis: pis.trim() || null,
          ctps_numero: ctpsNumero.trim() || null,
          ctps_serie: ctpsSerie.trim() || null,
          data_nascimento: dataNascimento || null,
          nome_mae: nomeMae.trim() || null,
          estado_civil: estadoCivil || null,
          escolaridade: escolaridade || null,
          endereco_cep: cep || null,
          endereco_rua: rua.trim() || null,
          endereco_numero: numero.trim() || null,
          endereco_complemento: complemento.trim() || null,
          endereco_bairro: bairro.trim() || null,
          endereco_cidade: cidade.trim() || null,
          endereco_estado: estado.trim() || null,
          banco_nome: bancoNome.trim() || null,
          banco_agencia: bancoAgencia.trim() || null,
          banco_conta: bancoConta.trim() || null,
          banco_tipo_conta: bancoTipoConta || null,
          tipo_contrato: tipoContrato,
          empresa_emissora: empresaEmissora,
          salario_base: salarioBase ? Number(salarioBase) : null,
          recebe_alelo: recebeAlelo,
          alelo_valor_dia: recebeAlelo ? Number(aleloValorDia) || 15.0 : null,
          has_vt: hasVt,
          vt_cash: hasVt ? vtCash : false,
          vt_value: hasVt ? Number(vtValue) || 0 : 0,
          transporte_tipo: hasVt ? transporteTipo : "nenhum",
        };

        const { error: updErr } = await (supabase as any)
          .from("employees")
          .update(extraPatch)
          .eq("id", id);
        if (updErr) throw updErr;
      }

      toast.success(`${name} admitido(a) em ${admissionDate}`);
      reset();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Erro ao admitir: ${err.message}`);
    }
  };

  const progress = ((step + 1) / 4) * 100;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Admissão de Funcionário — {STEP_LABELS[step]}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEP_LABELS.map((label, i) => (
              <span key={label} className={i === step ? "font-semibold text-foreground" : ""}>
                {i + 1}. {label}
              </span>
            ))}
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        {step === 0 && (
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <Label>Nome completo *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome" />
            </div>
            <div>
              <Label>CPF</Label>
              <Input value={cpf} onChange={(e) => setCpf(formatCpf(e.target.value))} maxLength={14} placeholder="000.000.000-00" />
            </div>
            <div>
              <Label>RG</Label>
              <Input value={rg} onChange={(e) => setRg(e.target.value)} placeholder="0.000.000" />
            </div>
            <div>
              <Label>Matrícula</Label>
              <Input value={matricula} onChange={(e) => setMatricula(e.target.value.toUpperCase())} maxLength={10} placeholder="000XXX ou PREST-XXX" />
            </div>
            <div>
              <Label>Data de nascimento</Label>
              <Input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label>Nome da mãe</Label>
              <Input value={nomeMae} onChange={(e) => setNomeMae(e.target.value)} />
            </div>
            <div>
              <Label>Estado civil</Label>
              <Select value={estadoCivil} onValueChange={setEstadoCivil}>
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
              <Label>Escolaridade</Label>
              <Select value={escolaridade} onValueChange={setEscolaridade}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fundamental_incompleto">Fundamental incompleto</SelectItem>
                  <SelectItem value="fundamental">Fundamental</SelectItem>
                  <SelectItem value="medio_incompleto">Médio incompleto</SelectItem>
                  <SelectItem value="medio">Médio</SelectItem>
                  <SelectItem value="tecnico">Técnico</SelectItem>
                  <SelectItem value="superior_incompleto">Superior incompleto</SelectItem>
                  <SelectItem value="superior">Superior</SelectItem>
                  <SelectItem value="pos">Pós-graduação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Telefone</Label>
              <Input value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="(81) 99999-0000" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4 mt-2">
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Endereço</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>CEP</Label>
                  <Input value={cep} onChange={(e) => setCep(formatCep(e.target.value))} maxLength={9} placeholder="00000-000" />
                  {cepLookup.loading && <p className="text-[10px] text-muted-foreground">Buscando...</p>}
                  {cepLookup.error && <p className="text-[10px] text-red-500">{cepLookup.error}</p>}
                </div>
                <div className="col-span-2">
                  <Label>Rua</Label>
                  <Input value={rua} onChange={(e) => setRua(e.target.value)} />
                </div>
                <div>
                  <Label>Número</Label>
                  <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
                </div>
                <div>
                  <Label>Complemento</Label>
                  <Input value={complemento} onChange={(e) => setComplemento(e.target.value)} />
                </div>
                <div>
                  <Label>Bairro</Label>
                  <Input value={bairro} onChange={(e) => setBairro(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Cidade</Label>
                  <Input value={cidade} onChange={(e) => setCidade(e.target.value)} />
                </div>
                <div>
                  <Label>UF</Label>
                  <Input value={estado} onChange={(e) => setEstado(e.target.value.toUpperCase().slice(0, 2))} maxLength={2} />
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase mb-2">Conta bancária</p>
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-2">
                  <Label>Banco</Label>
                  <Input value={bancoNome} onChange={(e) => setBancoNome(e.target.value)} placeholder="Ex: Bradesco" />
                </div>
                <div>
                  <Label>Agência</Label>
                  <Input value={bancoAgencia} onChange={(e) => setBancoAgencia(e.target.value)} />
                </div>
                <div>
                  <Label>Conta</Label>
                  <Input value={bancoConta} onChange={(e) => setBancoConta(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label>Tipo</Label>
                  <Select value={bancoTipoConta} onValueChange={setBancoTipoConta}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="corrente">Conta corrente</SelectItem>
                      <SelectItem value="poupanca">Poupança</SelectItem>
                      <SelectItem value="salario">Conta salário</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-2 gap-3 mt-2">
            <div className="col-span-2">
              <Label>Função</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ALL_EMPLOYEE_ROLES.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Data de admissão</Label>
              <Input type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} />
            </div>
            <div>
              <Label>Tipo de contrato</Label>
              <Select value={tipoContrato} onValueChange={setTipoContrato}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="clt">CLT</SelectItem>
                  <SelectItem value="prestador">Prestador</SelectItem>
                  <SelectItem value="estagiario">Estagiário</SelectItem>
                  <SelectItem value="temporario">Temporário</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Empresa emissora</Label>
              <Select value={empresaEmissora} onValueChange={setEmpresaEmissora}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gonzaga_berlim">Gonzaga e Berlim</SelectItem>
                  <SelectItem value="ag_cartografia">AG Cartografia</SelectItem>
                  <SelectItem value="ag_topografia_avulsa">AG Topografia (Avulsa)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Salário base (R$)</Label>
              <Input type="number" step="0.01" value={salarioBase} onChange={(e) => setSalarioBase(e.target.value)} placeholder="0,00" />
            </div>
            <div>
              <Label>PIS / NIT</Label>
              <Input value={pis} onChange={(e) => setPis(e.target.value)} />
            </div>
            <div>
              <Label>CTPS — Número</Label>
              <Input value={ctpsNumero} onChange={(e) => setCtpsNumero(e.target.value)} />
            </div>
            <div>
              <Label>CTPS — Série</Label>
              <Input value={ctpsSerie} onChange={(e) => setCtpsSerie(e.target.value)} />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4 mt-2">
            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Alelo (Vale Refeição)</p>
                  <p className="text-xs text-muted-foreground">Fixo mensal — ajuste por faltas dia 26</p>
                </div>
                <Switch checked={recebeAlelo} onCheckedChange={setRecebeAlelo} />
              </div>
              {recebeAlelo && (
                <div>
                  <Label>Valor por dia (R$)</Label>
                  <Input type="number" step="0.01" value={aleloValorDia} onChange={(e) => setAleloValorDia(e.target.value)} />
                </div>
              )}
            </div>

            <div className="border rounded-lg p-3 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Vale Transporte</p>
                  <p className="text-xs text-muted-foreground">VT cartão (R$4,50/viagem) ou dinheiro</p>
                </div>
                <Switch checked={hasVt} onCheckedChange={setHasVt} />
              </div>
              {hasVt && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Tipo de transporte</Label>
                    <Select value={transporteTipo} onValueChange={setTransporteTipo}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vt_cartao">VT cartão</SelectItem>
                        <SelectItem value="vem">VEM (passagem)</SelectItem>
                        <SelectItem value="dinheiro">Dinheiro</SelectItem>
                        <SelectItem value="nenhum">Não recebe</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center justify-between pt-6">
                    <Label>Pago em dinheiro</Label>
                    <Switch checked={vtCash} onCheckedChange={setVtCash} />
                  </div>
                  <div className="col-span-2">
                    <Label>Valor VT mensal (R$)</Label>
                    <Input type="number" step="0.01" value={vtValue} onChange={(e) => setVtValue(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <div className="bg-muted rounded-md p-3 text-xs space-y-1">
              <p className="font-semibold">Resumo</p>
              <p><strong>{name || "(sem nome)"}</strong> · {role} · {tipoContrato.toUpperCase()}</p>
              <p>Admissão: {admissionDate} · Empresa: {empresaEmissora.replace(/_/g, " ")}</p>
              {salarioBase && <p>Salário base: R$ {salarioBase}</p>}
              {recebeAlelo && <p>Alelo: R$ {aleloValorDia}/dia</p>}
              {hasVt && <p>VT: {transporteTipo} {vtCash ? "(dinheiro)" : ""}</p>}
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 justify-between flex-row">
          <Button variant="outline" onClick={handleBack} disabled={step === 0}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          {step < 3 ? (
            <Button onClick={handleNext} disabled={!canAdvance()}>
              Próximo <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={createEmp.isPending}>
              <Check className="w-4 h-4 mr-1" />
              {createEmp.isPending ? "Admitindo..." : "Admitir"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
