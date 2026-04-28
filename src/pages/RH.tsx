import { Routes, Route, Navigate } from "react-router-dom";
import Funcionarios from "./rh/Funcionarios";
import FichaFuncionario from "./rh/FichaFuncionario";
import RelatorioAusencias from "./rh/RelatorioAusencias";
import Ferias from "./rh/Ferias";
import Documentos from "./rh/Documentos";
import DescontosMensais from "./rh/DescontosMensais";

export default function RH() {
  return (
    <Routes>
      <Route index element={<Navigate to="funcionarios" replace />} />
      <Route path="funcionarios" element={<Funcionarios />} />
      <Route path="funcionarios/:id" element={<FichaFuncionario />} />
      <Route path="ferias" element={<Ferias />} />
      <Route path="ausencias" element={<RelatorioAusencias />} />
      <Route path="documentos" element={<Documentos />} />
      <Route path="compliance" element={<Navigate to="/compliance" replace />} />
      <Route path="compliance/*" element={<Navigate to="/compliance" replace />} />
      <Route path="descontos" element={<DescontosMensais />} />
      <Route path="*" element={<Navigate to="funcionarios" replace />} />
    </Routes>
  );
}
