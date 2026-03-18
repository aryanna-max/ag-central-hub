import { Building2 } from "lucide-react";
import ModulePage from "@/components/ModulePage";

export default function Clientes() {
  return (
    <ModulePage
      title="Clientes"
      subtitle="Base completa de clientes com histórico de interações"
      icon={<Building2 className="w-5 h-5" />}
      sections={[
        { title: "Base de Clientes", description: "Cadastro e consulta de todos os clientes ativos." },
        { title: "Histórico", description: "Registro de interações, projetos e propostas por cliente." },
      ]}
    />
  );
}
