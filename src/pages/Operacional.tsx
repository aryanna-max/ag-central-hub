import { Routes, Route, Navigate } from "react-router-dom";
import DashboardOperacional from "./operacional/DashboardOperacional";
import Planejamento from "./operacional/Planejamento";
import DespesasDeCampoTabs from "./operacional/DespesasDeCampoTabs";
import Veiculos from "./operacional/Veiculos";
import RDFDigital from "./operacional/RDFDigital";
import Medicoes from "./operacional/Medicoes";

export default function Operacional() {
  return (
    <Routes>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<DashboardOperacional />} />
      <Route path="escala" element={<Planejamento />} />
      <Route path="despesas-de-campo" element={<DespesasDeCampoTabs />} />
      <Route path="veiculos" element={<Veiculos />} />
      <Route path="rdf" element={<RDFDigital />} />
      <Route path="medicoes" element={<Medicoes />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}
