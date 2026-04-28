import { useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useAuth } from "@/contexts/AuthContext";
import MobileHome from "@/components/mobile/MobileHome";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PorProjeto from "@/pages/diretoria/PorProjeto";
import PorCliente from "@/pages/diretoria/PorCliente";

type DiretoriaTab = "clientes" | "projetos";

const TAB_STORAGE_KEY = "diretoria_active_tab";

function readSavedTab(): DiretoriaTab {
  if (typeof window === "undefined") return "clientes";
  const v = window.localStorage.getItem(TAB_STORAGE_KEY);
  return v === "projetos" || v === "clientes" ? v : "clientes";
}

export default function Dashboard() {
  const isMobile = useIsMobile();
  const { role } = useAuth();
  const [activeTab, setActiveTab] = useState<DiretoriaTab>(readSavedTab);

  useEffect(() => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(TAB_STORAGE_KEY, activeTab);
    }
  }, [activeTab]);

  if (isMobile) return <MobileHome />;

  // Sala técnica nunca vê financeiro (P5). Tab Por Cliente exibe `aReceber`,
  // então fica oculta — sala_tecnica vê só Por Projeto direto.
  if (role === "sala_tecnica") {
    return (
      <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
        <h1 className="text-2xl font-bold">Radar</h1>
        <PorProjeto />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Radar</h1>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => setActiveTab(v as DiretoriaTab)}
        className="space-y-4"
      >
        <TabsList>
          <TabsTrigger value="clientes">Por Cliente</TabsTrigger>
          <TabsTrigger value="projetos">Por Projeto</TabsTrigger>
        </TabsList>

        <TabsContent value="clientes" className="space-y-4 mt-0">
          <PorCliente />
        </TabsContent>

        <TabsContent value="projetos" className="space-y-4 mt-0">
          <PorProjeto />
        </TabsContent>
      </Tabs>
    </div>
  );
}
