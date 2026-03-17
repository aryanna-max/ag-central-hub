import { Monitor } from "lucide-react";
import ModulePage from "@/components/ModulePage";

export default function SalaTecnica() {
  return (
    <ModulePage
      title="Sala Técnica"
      subtitle="Processamento técnico, arquivos e entregas"
      icon={<Monitor className="w-5 h-5" />}
      sections={[
        { title: "Arquivos", description: "Recebimento e organização de arquivos técnicos." },
        { title: "Processamento", description: "Acompanhamento do processamento de dados de campo." },
        { title: "Entregas", description: "Controle de entregas técnicas ao cliente." },
        { title: "Relatórios Técnicos", description: "Emissão e gestão de relatórios." },
      ]}
    />
  );
}
