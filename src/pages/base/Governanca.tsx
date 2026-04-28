import { FileCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import CompanyDocsList from "./CompanyDocsList";

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

      <Card>
        <CardContent className="pt-6">
          <CompanyDocsList />
        </CardContent>
      </Card>
    </div>
  );
}
