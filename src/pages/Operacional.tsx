import { Routes, Route, Navigate } from "react-router-dom";
import Equipes from "./operacional/Equipes";
import EscalaDiaria from "./operacional/EscalaDiaria";
import EscalaMensal from "./operacional/EscalaMensal";
import Veiculos from "./operacional/Veiculos";

export default function Operacional() {
  return (
    <Routes>
      <Route path="equipes" element={<Equipes />} />
      <Route path="escala" element={<EscalaMensal />} />
      <Route path="escala-diaria" element={<EscalaDiaria />} />
      <Route path="veiculos" element={<Veiculos />} />
      <Route path="*" element={<Navigate to="equipes" replace />} />
    </Routes>
  );
}
