import { FileText } from "lucide-react";
import ModulePage from "@/components/ModulePage";

export default function Propostas() {
  return (
    <ModulePage
      title="Propostas"
      subtitle="Geração e emissão de propostas comerciais"
      icon={<FileText className="w-5 h-5" />}
      sections={[
        { title: "Nova Proposta", description: "Gerar proposta por AG Topografia ou AG Cartografia." },
        { title: "Propostas Enviadas", description: "Acompanhamento de propostas enviadas aos clientes." },
        { title: "Aprovadas", description: "Propostas aprovadas prontas para conversão em projeto." },
        { title: "Histórico", description: "Registro completo de todas as propostas emitidas." },
      ]}
    />
  );
}
