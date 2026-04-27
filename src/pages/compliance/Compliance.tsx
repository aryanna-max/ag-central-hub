import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import CalendarioMensal from "./CalendarioMensal";
import RequisitosClientesReadonly from "./RequisitosClientesReadonly";
import Documentos from "@/pages/rh/Documentos";

interface PlaceholderProps {
  title: string;
  description: string;
}

function SectionPlaceholder({ title, description }: PlaceholderProps) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-sm text-muted-foreground">
          Esta seção ganha conteúdo no Bloco 3 do ADR-041 (cockpit agregado).
        </p>
      </CardContent>
    </Card>
  );
}

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
        <Route
          path="radar"
          element={
            <SectionPlaceholder
              title="Radar de Compliance"
              description="Visão consolidada de pendências críticas — documentos vencidos, calendário do mês, integrações por cliente."
            />
          }
        />
        <Route path="calendario" element={<CalendarioMensal />} />
        <Route path="empresa" element={<Navigate to="/base/governanca" replace />} />
        <Route path="funcionarios" element={<Documentos />} />
        <Route path="clientes" element={<RequisitosClientesReadonly />} />
        <Route
          path="portais"
          element={
            <SectionPlaceholder
              title="Portais Externos"
              description="Alldocs, SERTRAS e demais portais de envio documental por cliente."
            />
          }
        />
        <Route
          path="pendencias"
          element={
            <SectionPlaceholder
              title="Pendências"
              description="Lista única de itens vencidos ou a vencer — feed unificado a partir das células C6 dos módulos."
            />
          }
        />
        <Route path="*" element={<Navigate to="radar" replace />} />
      </Routes>
    </div>
  );
}
