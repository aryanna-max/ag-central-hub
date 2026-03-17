import { Truck } from "lucide-react";
import ModulePage from "@/components/ModulePage";

export default function Operacional() {
  return (
    <ModulePage
      title="Módulo Operacional"
      subtitle="Equipes, Escala Mensal e Veículos"
      icon={<Truck className="w-5 h-5" />}
      sections={[
        { title: "Equipes", description: "Gestão das equipes de campo e suas composições." },
        { title: "Escala Mensal", description: "Planejamento mensal de escalas por equipe." },
        { title: "Veículos", description: "Controle de frota e disponibilidade de veículos." },
        { title: "Planejamento", description: "Logística e programação das atividades de campo." },
      ]}
    />
  );
}
