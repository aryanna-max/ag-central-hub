import { Routes, Route, Navigate } from "react-router-dom";
import ModulePage from "@/components/ModulePage";
import { UserCog } from "lucide-react";
import Funcionarios from "./rh/Funcionarios";

function RHPlaceholder() {
  return (
    <ModulePage
      title="Módulo RH"
      subtitle="Funcionários, Documentos e Exames"
      icon={<UserCog className="w-5 h-5" />}
      sections={[
        { title: "Documentos", description: "Gestão de documentos de admissão e registros." },
        { title: "Exames", description: "Controle de exames admissionais e periódicos." },
        { title: "Integrações", description: "Vínculos com sistemas de folha e eSocial." },
      ]}
    />
  );
}

export default function RH() {
  return (
    <Routes>
      <Route index element={<Navigate to="funcionarios" replace />} />
      <Route path="funcionarios" element={<Funcionarios />} />
      <Route path="documentos" element={<RHPlaceholder />} />
      <Route path="exames" element={<RHPlaceholder />} />
      <Route path="*" element={<Navigate to="funcionarios" replace />} />
    </Routes>
  );
}
