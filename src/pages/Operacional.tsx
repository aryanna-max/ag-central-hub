import { Routes, Route, Navigate } from "react-router-dom";
import DashboardOperacional from "./operacional/DashboardOperacional";
import Equipes from "./operacional/Equipes";
import EscalaDiaria from "./operacional/EscalaDiaria";
import EscalaMensal from "./operacional/EscalaMensal";
import Veiculos from "./operacional/Veiculos";

export default function Operacional() {
  return (
    <Routes>
      <Route index element={<DashboardOperacional />} />
      <Route path="dashboard" element={<DashboardOperacional />} />
      <Route path="equipes" element={<Equipes />} />
      <Route path="escala" element={<EscalaMensal />} />
      <Route path="escala-diaria" element={<EscalaDiaria />} />
      <Route path="veiculos" element={<Veiculos />} />
      <Route path="*" element={<Navigate to="dashboard" replace />} />
    </Routes>
  );
}
