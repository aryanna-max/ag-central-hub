import { Users } from "lucide-react";
import ModulePage from "@/components/ModulePage";

export default function Comercial() {
  return (
    <ModulePage
      title="Módulo Comercial"
      subtitle="CRM, Leads, Oportunidades e Clientes"
      icon={<Users className="w-5 h-5" />}
      sections={[
        { title: "Leads", description: "Captação e qualificação de novos contatos de todos os canais." },
        { title: "Oportunidades", description: "Pipeline de vendas com acompanhamento de cada negociação." },
        { title: "Clientes", description: "Base completa de clientes com histórico de interações." },
        { title: "CRM Unificado", description: "Todas as demandas de WhatsApp, telefone, e-mail e site centralizadas." },
      ]}
    />
  );
}
