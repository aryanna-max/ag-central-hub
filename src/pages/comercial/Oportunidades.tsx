import { Users } from "lucide-react";
import ModulePage from "@/components/ModulePage";

export default function Oportunidades() {
  return (
    <ModulePage
      title="Oportunidades"
      subtitle="Pipeline de vendas com acompanhamento de cada negociação"
      icon={<Users className="w-5 h-5" />}
      sections={[
        { title: "Pipeline", description: "Visualize oportunidades em cada etapa do funil de vendas." },
        { title: "Em Negociação", description: "Acompanhe propostas enviadas e negociações ativas." },
        { title: "Fechadas", description: "Oportunidades convertidas em projetos ou perdidas." },
      ]}
    />
  );
}
