import { Routes, Route, Navigate } from "react-router-dom";
import Funcionarios from "./rh/Funcionarios";
import RelatorioAusencias from "./rh/RelatorioAusencias";
import Ferias from "./rh/Ferias";
import Documentos from "./rh/Documentos";
import Compliance from "./rh/Compliance";
import DescontosMensais from "./rh/DescontosMensais";

export default function RH() {
  return (
    <Routes>
      <Route index element={<Navigate to="funcionarios" replace />} />
      <Route path="funcionarios" element={<Funcionarios />} />
      <Route path="descontos-mensais" element={<DescontosMensais />} />
      <Route path="ferias" element={<Ferias />} />
      <Route path="ausencias" element={<RelatorioAusencias />} />
      <Route path="documentos" element={<Documentos />} />
      <Route path="compliance" element={<Compliance />} />
      <Route path="*" element={<Navigate to="funcionarios" replace />} />
    </Routes>
  );
}
