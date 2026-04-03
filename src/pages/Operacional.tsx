import { Routes, Route, Navigate } from "react-router-dom";
import DashboardOperacional from "./operacional/DashboardOperacional";
import Equipes from "./operacional/Equipes";
import EscalaDiaria from "./operacional/EscalaDiaria";
import EscalaMensal from "./operacional/EscalaMensal";
import Medicoes from "./operacional/Medicoes";
import DespesasDeCampo from "./operacional/DespesasDeCampo";
import Veiculos from "./operacional/Veiculos";
import DiariasVeiculos from "./operacional/DiariasVeiculos";
import ProjetosEmCampoKanban from "./operacional/ProjetosEmCampoKanban";
import Ferias from "./operacional/Ferias";
import Relatorios from "./operacional/Relatorios";

export default function Operacional() {
  return (
    <Routes>
      <Route index element={<Navigate to="projetos-campo" replace />} />
      <Route path="dashboard" element={<DashboardOperacional />} />
      <Route path="projetos-campo" element={<ProjetosEmCampoKanban />} />
      <Route path="equipes" element={<Equipes />} />
      <Route path="escala" element={<EscalaMensal />} />
      <Route path="escala-diaria" element={<EscalaDiaria />} />
      <Route path="medicoes" element={<Medicoes />} />
      <Route path="despesas-de-campo" element={<DespesasDeCampo />} />
      <Route path="veiculos" element={<Veiculos />} />
      <Route path="diarias-veiculos" element={<DiariasVeiculos />} />
      <Route path="ferias" element={<Ferias />} />
      <Route path="relatorios" element={<Relatorios />} />
      <Route path="*" element={<Navigate to="projetos-campo" replace />} />
    </Routes>
  );
}
