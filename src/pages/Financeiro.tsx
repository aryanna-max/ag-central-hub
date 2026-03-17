import { DollarSign } from "lucide-react";
import ModulePage from "@/components/ModulePage";

export default function Financeiro() {
  return (
    <ModulePage
      title="Módulo Financeiro"
      subtitle="Faturamento, Pagamentos e Contas a Pagar/Receber"
      icon={<DollarSign className="w-5 h-5" />}
      sections={[
        { title: "Faturamento", description: "Emissão e acompanhamento de notas fiscais." },
        { title: "Pagamentos", description: "Controle de pagamentos realizados e pendentes." },
        { title: "Contas a Pagar", description: "Gestão de obrigações financeiras." },
        { title: "Contas a Receber", description: "Acompanhamento de recebíveis e inadimplência." },
      ]}
    />
  );
}
