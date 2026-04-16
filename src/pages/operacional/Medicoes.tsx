import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ControleCampoTab from "@/components/operacional/medicoes/ControleCampoTab";
import BoletinsMedicaoTab from "@/components/operacional/medicoes/BoletinsMedicaoTab";

export default function Medicoes() {
  const [activeTab, setActiveTab] = useState("controle-campo");

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <BarChart3 className="w-6 h-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Medições</h1>
          <p className="text-sm text-muted-foreground">
            Controle de campo e boletins de medição
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="controle-campo">Controle de Campo</TabsTrigger>
          <TabsTrigger value="boletins">Boletins de Medição</TabsTrigger>
        </TabsList>

        <TabsContent value="controle-campo" className="mt-4">
          <ControleCampoTab
            onCreateMeasurement={() => setActiveTab("boletins")}
          />
        </TabsContent>

        <TabsContent value="boletins" className="mt-4">
          <BoletinsMedicaoTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
