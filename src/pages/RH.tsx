import { UserCog } from "lucide-react";
import ModulePage from "@/components/ModulePage";

export default function RH() {
  return (
    <ModulePage
      title="Módulo RH"
      subtitle="Funcionários, Documentos e Exames"
      icon={<UserCog className="w-5 h-5" />}
      sections={[
        { title: "Funcionários", description: "Cadastro completo e dados dos colaboradores." },
        { title: "Documentos", description: "Gestão de documentos de admissão e registros." },
        { title: "Exames", description: "Controle de exames admissionais e periódicos." },
        { title: "Integrações", description: "Vínculos com sistemas de folha e eSocial." },
      ]}
    />
  );
}
