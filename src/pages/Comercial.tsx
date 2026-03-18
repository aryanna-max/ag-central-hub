import { Routes, Route, Navigate } from "react-router-dom";
import Leads from "./comercial/Leads";
import Oportunidades from "./comercial/Oportunidades";
import Clientes from "./comercial/Clientes";

export default function Comercial() {
  return (
    <Routes>
      <Route index element={<Navigate to="leads" replace />} />
      <Route path="leads" element={<Leads />} />
      <Route path="oportunidades" element={<Oportunidades />} />
      <Route path="clientes" element={<Clientes />} />
      <Route path="*" element={<Navigate to="leads" replace />} />
    </Routes>
  );
}
