import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { Monitor } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import STKanban from "./salatecnica/STKanban";
import STEquipe from "./salatecnica/STEquipe";
import STMinhasTarefas from "./salatecnica/STMinhasTarefas";
import STAlertas from "./salatecnica/STAlertas";
import STProjectDetail from "./salatecnica/STProjectDetail";

const TABS = [
  { value: "projetos", label: "Projetos", path: "/sala-tecnica" },
  { value: "equipe", label: "Equipe", path: "/sala-tecnica/equipe" },
  { value: "minhas-tarefas", label: "Minhas Tarefas", path: "/sala-tecnica/minhas-tarefas" },
  { value: "alertas", label: "Alertas", path: "/sala-tecnica/alertas" },
];

export default function SalaTecnica() {
  const navigate = useNavigate();
  const location = useLocation();

  const currentTab = location.pathname.includes("/equipe")
    ? "equipe"
    : location.pathname.includes("/minhas-tarefas")
      ? "minhas-tarefas"
      : location.pathname.includes("/alertas")
        ? "alertas"
        : "projetos";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Monitor className="w-5 h-5 text-primary" />
        <h1 className="text-xl font-bold">Prancheta</h1>
      </div>

      {!location.pathname.includes("/projetos/") && (
        <Tabs value={currentTab} onValueChange={v => {
          const tab = TABS.find(t => t.value === v);
          if (tab) navigate(tab.path);
        }}>
          <TabsList>
            {TABS.map(t => <TabsTrigger key={t.value} value={t.value}>{t.label}</TabsTrigger>)}
          </TabsList>
        </Tabs>
      )}

      <Routes>
        <Route index element={<STKanban />} />
        <Route path="equipe" element={<STEquipe />} />
        <Route path="minhas-tarefas" element={<STMinhasTarefas />} />
        <Route path="alertas" element={<STAlertas />} />
        <Route path="projetos/:id" element={<STProjectDetail />} />
      </Routes>
    </div>
  );
}
