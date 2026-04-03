import { useState } from "react";
import { CalendarDays } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import EscalaDiaria from "./EscalaDiaria";
import EscalaMensal from "./EscalaMensal";
import Equipes from "./Equipes";
import PlanningReportsTab from "@/components/operacional/PlanningReportsTab";

export default function Planejamento() {
  const [tab, setTab] = useState("hoje");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <CalendarDays className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Planejamento</h1>
          <p className="text-sm text-muted-foreground">Escalas, grupos rápidos e relatórios</p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="hoje">Escala Diária</TabsTrigger>
          <TabsTrigger value="mensal">Visão Mensal</TabsTrigger>
          <TabsTrigger value="grupos">Grupos Rápidos</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="hoje">
          <EscalaDiaria />
        </TabsContent>

        <TabsContent value="mensal">
          <EscalaMensal />
        </TabsContent>

        <TabsContent value="grupos">
          <Equipes />
        </TabsContent>

        <TabsContent value="relatorios">
          <PlanningReportsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
