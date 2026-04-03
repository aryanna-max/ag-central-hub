import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import FaturamentoAlertas from "./FaturamentoAlertas";
import FaturamentoPipeline from "./FaturamentoPipeline";
import FaturamentoMedicoes from "./FaturamentoMedicoes";
import FaturamentoProjetos from "./FaturamentoProjetos";
import FaturamentoRelatorios from "./FaturamentoRelatorios";

export default function FinanceiroDashboard() {
  const [tab, setTab] = useState("alertas");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Faturamento</h1>
        <p className="text-muted-foreground text-sm">
          Gestão de NFs, recibos, medições e acompanhamento financeiro
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="alertas">Alertas</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="medicoes">Medições</TabsTrigger>
          <TabsTrigger value="projetos">Projetos</TabsTrigger>
          <TabsTrigger value="relatorios">Relatórios</TabsTrigger>
        </TabsList>

        <TabsContent value="alertas">
          <FaturamentoAlertas />
        </TabsContent>
        <TabsContent value="pipeline">
          <FaturamentoPipeline />
        </TabsContent>
        <TabsContent value="medicoes">
          <FaturamentoMedicoes />
        </TabsContent>
        <TabsContent value="projetos">
          <FaturamentoProjetos />
        </TabsContent>
        <TabsContent value="relatorios">
          <FaturamentoRelatorios />
        </TabsContent>
      </Tabs>
    </div>
  );
}
