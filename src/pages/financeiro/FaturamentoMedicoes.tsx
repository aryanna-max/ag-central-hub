import { Card, CardContent } from "@/components/ui/card";
import { Clock } from "lucide-react";

export default function FaturamentoMedicoes() {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <Clock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <h3 className="text-lg font-semibold">Medições</h3>
        <p className="text-sm text-muted-foreground mt-1">Em breve</p>
      </CardContent>
    </Card>
  );
}
