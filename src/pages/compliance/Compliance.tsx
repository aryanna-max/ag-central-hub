import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import CalendarioMensal from "./CalendarioMensal";
import RequisitosClientesReadonly from "./RequisitosClientesReadonly";
import ComplianceRadar from "./ComplianceRadar";
import Portais from "./Portais";
import Pendencias from "./Pendencias";
import Documentos from "@/pages/rh/Documentos";

const subnav = [
  { label: "Radar", path: "/compliance/radar" },
  { label: "Calendário", path: "/compliance/calendario" },
  { label: "Funcionários", path: "/compliance/funcionarios" },
  { label: "Clientes", path: "/compliance/clientes" },
  { label: "Portais", path: "/compliance/portais" },
  { label: "Pendências", path: "/compliance/pendencias" },
];

export default function Compliance() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Compliance</h1>
          <p className="text-muted-foreground text-sm">
            Cockpit navegacional transversal (ADR-041)
          </p>
        </div>
      </div>

      <nav className="flex flex-wrap gap-1 border-b border-border">
        {subnav.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                isActive
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <Routes>
        <Route index element={<Navigate to="radar" replace />} />
        <Route path="radar" element={<ComplianceRadar />} />
        <Route path="calendario" element={<CalendarioMensal />} />
        <Route path="empresa" element={<Navigate to="/base/governanca" replace />} />
        <Route path="funcionarios" element={<Documentos />} />
        <Route path="clientes" element={<RequisitosClientesReadonly />} />
        <Route path="portais" element={<Portais />} />
        <Route path="pendencias" element={<Pendencias />} />
        <Route path="*" element={<Navigate to="radar" replace />} />
      </Routes>
    </div>
  );
}
