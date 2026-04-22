import { Badge } from "@/components/ui/badge";
import { CircleCheck, CircleAlert } from "lucide-react";

// =============================================================================
// EmployeeCompletudeBadge
// =============================================================================
// Calcula e exibe o % de completude do cadastro de um funcionário.
// Objetivo: sinalizar visualmente funcionários com dados faltando para que
// Alcione priorize o preenchimento.
//
// NÃO conta todos os 42+ campos — só os "essenciais para operação e compliance".
// Campos bancários e emergência pesam menos que CPF/admissão.
// =============================================================================

export type Completude = {
  preenchidos: number;
  total: number;
  percentual: number;
  camposFaltando: string[];
  nivel: "critico" | "incompleto" | "ok" | "completo";
};

// Campos essenciais agrupados por categoria
const CAMPOS_ESSENCIAIS: Array<{
  key: string;
  label: string;
  peso: number; // 1 = nice-to-have, 2 = importante, 3 = crítico
}> = [
  // Identificação (CRÍTICO)
  { key: "name", label: "Nome", peso: 3 },
  { key: "cpf", label: "CPF", peso: 3 },
  { key: "rg", label: "RG", peso: 2 },
  { key: "pis", label: "PIS", peso: 3 },
  { key: "matricula", label: "Matrícula", peso: 3 },
  { key: "data_nascimento", label: "Data nascimento", peso: 2 },
  { key: "nome_mae", label: "Nome da mãe", peso: 2 },
  { key: "phone", label: "Telefone", peso: 2 },
  // Endereço (IMPORTANTE)
  { key: "cep", label: "CEP", peso: 2 },
  { key: "rua", label: "Rua", peso: 2 },
  { key: "numero", label: "Número", peso: 2 },
  { key: "cidade", label: "Cidade", peso: 2 },
  { key: "estado", label: "Estado", peso: 2 },
  // Contrato (CRÍTICO)
  { key: "admission_date", label: "Data admissão", peso: 3 },
  { key: "tipo_contrato", label: "Tipo contrato", peso: 3 },
  { key: "empresa_contratante", label: "Empresa", peso: 3 },
  { key: "role", label: "Cargo", peso: 3 },
  { key: "salario_base", label: "Salário base", peso: 3 },
  { key: "jornada", label: "Jornada", peso: 2 },
  // Bancário (IMPORTANTE)
  { key: "banco", label: "Banco", peso: 2 },
  { key: "agencia", label: "Agência", peso: 2 },
  { key: "conta", label: "Conta", peso: 2 },
  // Transporte (IMPORTANTE)
  { key: "transporte_tipo", label: "Transporte", peso: 2 },
  // CLT (para CLTs)
  { key: "ctps_numero", label: "CTPS", peso: 1 },
  // Emergência (NICE)
  { key: "contato_emergencia_nome", label: "Contato emergência", peso: 1 },
  { key: "contato_emergencia_telefone", label: "Tel emergência", peso: 1 },
];

export function calculateCompletude(
  employee: Record<string, unknown> | undefined | null
): Completude {
  if (!employee) {
    return { preenchidos: 0, total: 0, percentual: 0, camposFaltando: [], nivel: "critico" };
  }

  // Soma ponderada
  let pesoTotal = 0;
  let pesoPreenchido = 0;
  const camposFaltando: string[] = [];

  for (const c of CAMPOS_ESSENCIAIS) {
    pesoTotal += c.peso;
    const value = employee[c.key];
    const filled =
      value !== null &&
      value !== undefined &&
      value !== "" &&
      value !== 0;
    if (filled) {
      pesoPreenchido += c.peso;
    } else {
      camposFaltando.push(c.label);
    }
  }

  const percentual = pesoTotal > 0 ? Math.round((pesoPreenchido / pesoTotal) * 100) : 0;

  let nivel: Completude["nivel"];
  if (percentual >= 95) nivel = "completo";
  else if (percentual >= 75) nivel = "ok";
  else if (percentual >= 40) nivel = "incompleto";
  else nivel = "critico";

  return {
    preenchidos: CAMPOS_ESSENCIAIS.length - camposFaltando.length,
    total: CAMPOS_ESSENCIAIS.length,
    percentual,
    camposFaltando,
    nivel,
  };
}

export default function EmployeeCompletudeBadge({
  completude,
  size = "default",
}: {
  completude: Completude;
  size?: "default" | "small";
}) {
  const color = {
    completo: "bg-green-100 text-green-800 border-green-300",
    ok: "bg-emerald-50 text-emerald-700 border-emerald-200",
    incompleto: "bg-amber-100 text-amber-800 border-amber-300",
    critico: "bg-red-100 text-red-800 border-red-300",
  }[completude.nivel];

  const Icon = completude.nivel === "completo" || completude.nivel === "ok"
    ? CircleCheck
    : CircleAlert;

  return (
    <Badge
      variant="outline"
      className={`${color} ${size === "small" ? "text-[10px] h-5 px-1.5" : ""}`}
      title={
        completude.camposFaltando.length > 0
          ? `Faltam: ${completude.camposFaltando.join(", ")}`
          : "Cadastro completo"
      }
    >
      <Icon className={size === "small" ? "w-3 h-3 mr-1" : "w-3.5 h-3.5 mr-1"} />
      {completude.percentual}%
    </Badge>
  );
}
