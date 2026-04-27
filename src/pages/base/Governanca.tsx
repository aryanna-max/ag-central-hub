import { FileCheck } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BaseGovernanca() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
          <FileCheck className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Governança</h1>
          <p className="text-muted-foreground text-sm">
            Documentos corporativos das empresas emissoras (ADR-041)
          </p>
        </div>
      </div>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg">Documentos da Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Esta seção está sendo construída. Conteúdo virá no Bloco 2 do ADR-041.
          </p>
          <a
            href="/rh/compliance"
            className="inline-flex items-center text-sm font-medium text-primary hover:underline"
          >
            Ver docs empresa em /rh/compliance (atual) →
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
