import { FolderKanban } from "lucide-react";
import ModulePage from "@/components/ModulePage";

export default function Projetos() {
  return (
    <ModulePage
      title="Projetos"
      subtitle="Gestão de projetos criados a partir de propostas aprovadas"
      icon={<FolderKanban className="w-5 h-5" />}
      sections={[
        { title: "Em Andamento", description: "Projetos ativos com status de execução." },
        { title: "Kanban", description: "Visão de quadro para acompanhamento visual." },
        { title: "Concluídos", description: "Projetos finalizados e entregues." },
      ]}
    />
  );
}
