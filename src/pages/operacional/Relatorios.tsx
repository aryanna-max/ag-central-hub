import { BarChart3 } from "lucide-react";
import ModulePage from "@/components/ModulePage";

export default function Relatorios() {
  return (
    <ModulePage
      title="Relatórios de Campo"
      subtitle="Relatórios operacionais e de desempenho"
      icon={<BarChart3 className="w-5 h-5" />}
      sections={[
        { title: "Relatório de Escalas", description: "Resumo de escalas diárias e mensais." },
        { title: "Relatório de Veículos", description: "KM rodados e custos por projeto." },
        { title: "Relatório de Ausências", description: "Faltas, folgas e atestados do período." },
      ]}
    />
  );
}
