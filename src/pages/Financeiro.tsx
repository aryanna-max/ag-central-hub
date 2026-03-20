import { Route, Routes } from "react-router-dom";
import FinanceiroDashboard from "./financeiro/FinanceiroDashboard";

export default function Financeiro() {
  return (
    <Routes>
      <Route path="/" element={<FinanceiroDashboard />} />
      <Route path="/dashboard" element={<FinanceiroDashboard />} />
    </Routes>
  );
}
