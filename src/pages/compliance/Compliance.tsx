import { NavLink, Navigate, Route, Routes } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PlaceholderProps {
  title: string;
  description: string;
  legacyPath?: string;
  legacyLabel?: string;
}

function SectionPlaceholder({ title, description, legacyPath, legacyLabel }: PlaceholderProps) {
  return (
    <Card className="border-dashed">
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{description}</p>
        <p className="text-sm text-muted-foreground">
          Esta seção está sendo construída. Conteúdo virá no Bloco 2 do ADR-041.
        </p>
        {legacyPath && (
          <a
            href={legacyPath}
            className="inline-flex items-center text-sm font-medium text-primary hover:underline"
          >
            {legacyLabel ?? "Ver no sistema atual"} →
          </a>
        )}
      </CardContent>
    </Card>
  );
}

const subnav = [
  { label: "Radar", path: "/compliance/radar" },
  { label: "Calendário", path: "/compliance/calendario" },
  { label: "Empresa", path: "/compliance/empresa" },
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
        <Route
          path="calendario"
          element={
            <SectionPlaceholder
              title="Calendário Mensal"
              description="Tarefas mensais recorrentes por cliente (CBC dia 10, BRK dia 15, Memorial Star dia 20, etc.)."
              legacyPath="/rh/compliance"
              legacyLabel="Ver no sistema atual (/rh/compliance)"
            />
          }
        />
        <Route
          path="empresa"
          element={
            <SectionPlaceholder
              title="Documentos da Empresa"
              description="PCMSO, PGR, Seguro de Vida e demais docs corporativos das 3 empresas emissoras."
              legacyPath="/rh/compliance"
              legacyLabel="Ver no sistema atual (/rh/compliance)"
            />
          }
        />
        <Route
          path="funcionarios"
          element={
            <SectionPlaceholder
              title="Documentos por Funcionário"
              description="ASO, NR-18, NR-35, Ficha EPI, Integrações de cliente — rastreio individual."
              legacyPath="/rh/documentos"
              legacyLabel="Ver no sistema atual (/rh/documentos)"
            />
          }
        />
        <Route
          path="clientes"
          element={
            <SectionPlaceholder
              title="Requisitos por Cliente"
              description="Compliance configurável por cliente (BRK, CBC, Aeroporto, etc.) — 2 camadas: universal + específico."
              legacyPath="/rh/compliance"
              legacyLabel="Ver no sistema atual (/rh/compliance)"
            />
          }
        />
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
