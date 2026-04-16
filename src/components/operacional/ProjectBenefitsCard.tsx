import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Coffee, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useProjectBenefits, useUpsertProjectBenefits } from "@/hooks/useProjectBenefits";

interface Props {
  projectId: string;
}

export default function ProjectBenefitsCard({ projectId }: Props) {
  const { data: benefits, isLoading } = useProjectBenefits(projectId);
  const upsert = useUpsertProjectBenefits();
  const { toast } = useToast();

  const [cafeEnabled, setCafeEnabled] = useState(false);
  const [cafeValue, setCafeValue] = useState(15);
  const [almocoType, setAlmocoType] = useState("nenhum");
  const [almocoDifValue, setAlmocoDifValue] = useState(0);
  const [jantarEnabled, setJantarEnabled] = useState(false);
  const [jantarValue, setJantarValue] = useState(20);
  const [hospedagemEnabled, setHospedagemEnabled] = useState(false);
  const [hospedagemValue, setHospedagemValue] = useState(0);

  useEffect(() => {
    if (benefits) {
      setCafeEnabled(benefits.cafe_enabled || false);
      setCafeValue(benefits.cafe_value || 15);
      setAlmocoType(benefits.almoco_type || "nenhum");
      setAlmocoDifValue(benefits.almoco_diferenca_value || 0);
      setJantarEnabled(benefits.jantar_enabled || false);
      setJantarValue(benefits.jantar_value || 20);
      setHospedagemEnabled(benefits.hospedagem_enabled || false);
      setHospedagemValue(benefits.hospedagem_value || 0);
    }
  }, [benefits]);

  const handleSave = async () => {
    try {
      await upsert.mutateAsync({
        project_id: projectId,
        cafe_enabled: cafeEnabled,
        cafe_value: cafeValue,
        almoco_type: almocoType,
        almoco_diferenca_value: almocoDifValue,
        jantar_enabled: jantarEnabled,
        jantar_value: jantarValue,
        hospedagem_enabled: hospedagemEnabled,
        hospedagem_value: hospedagemValue,
      });
      toast({ title: "Beneficios salvos" });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
  };

  if (isLoading) return <p className="text-xs text-muted-foreground">Carregando beneficios...</p>;

  return (
    <Card className="border-dashed">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="text-sm flex items-center gap-2">
          <Coffee className="w-4 h-4" /> Beneficios do Projeto
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-4">
        {/* Cafe */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Switch checked={cafeEnabled} onCheckedChange={setCafeEnabled} />
            <Label className="text-sm">Cafe</Label>
          </div>
          {cafeEnabled && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">R$</span>
              <Input
                type="number" step="0.01" min="0"
                className="h-8 w-20 text-xs"
                value={cafeValue}
                onChange={(e) => setCafeValue(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
        </div>

        {/* Almoco */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label className="text-sm">Almoco</Label>
            <Select value={almocoType} onValueChange={setAlmocoType}>
              <SelectTrigger className="h-8 w-32 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="nenhum">Nenhum</SelectItem>
                <SelectItem value="incluso">Incluso</SelectItem>
                <SelectItem value="diferenca">Diferenca</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {almocoType === "diferenca" && (
            <div className="flex items-center gap-1 ml-6">
              <span className="text-xs text-muted-foreground">R$</span>
              <Input
                type="number" step="0.01" min="0"
                className="h-8 w-20 text-xs"
                value={almocoDifValue}
                onChange={(e) => setAlmocoDifValue(parseFloat(e.target.value) || 0)}
              />
              <span className="text-xs text-muted-foreground">/dia</span>
            </div>
          )}
        </div>

        {/* Jantar */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Switch checked={jantarEnabled} onCheckedChange={setJantarEnabled} />
            <Label className="text-sm">Jantar</Label>
          </div>
          {jantarEnabled && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">R$</span>
              <Input
                type="number" step="0.01" min="0"
                className="h-8 w-20 text-xs"
                value={jantarValue}
                onChange={(e) => setJantarValue(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
        </div>

        {/* Hospedagem */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Switch checked={hospedagemEnabled} onCheckedChange={setHospedagemEnabled} />
            <Label className="text-sm">Hospedagem</Label>
          </div>
          {hospedagemEnabled && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground">R$</span>
              <Input
                type="number" step="0.01" min="0"
                className="h-8 w-20 text-xs"
                value={hospedagemValue}
                onChange={(e) => setHospedagemValue(parseFloat(e.target.value) || 0)}
              />
            </div>
          )}
        </div>

        <Button size="sm" onClick={handleSave} disabled={upsert.isPending} className="w-full gap-1">
          <Save className="w-3.5 h-3.5" /> Salvar Beneficios
        </Button>
      </CardContent>
    </Card>
  );
}
