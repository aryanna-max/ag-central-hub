import { Routes, Route, Navigate } from "react-router-dom";
import DashboardOperacional from "./operacional/DashboardOperacional";
import ProjetosEmCampoKanban from "./operacional/ProjetosEmCampoKanban";
import Planejamento from "./operacional/Planejamento";
import DespesasDeCampoTabs from "./operacional/DespesasDeCampoTabs";
import Veiculos from "./operacional/Veiculos";

export default function Operacional() {
  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<DashboardOperacional />} />
      <Route path="projetos-campo" element={<ProjetosEmCampoKanban />} />
      <Route path="escala" element={<Planejamento />} />
      <Route path="despesas-de-campo" element={<DespesasDeCampoTabs />} />
      <Route path="veiculos" element={<Veiculos />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}
