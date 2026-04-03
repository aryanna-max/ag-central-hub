import { Routes, Route, Navigate } from "react-router-dom";
import Leads from "./comercial/Leads";
import Clientes from "./comercial/Clientes";
import Propostas from "./comercial/Propostas";

export default function Comercial() {
  return (
    <Routes>
      <Route index element={<Navigate to="leads" replace />} />
      <Route path="leads" element={<Leads />} />
      <Route path="propostas" element={<Propostas />} />
      <Route path="clientes" element={<Clientes />} />
      <Route path="*" element={<Navigate to="leads" replace />} />
    </Routes>
  );
}
