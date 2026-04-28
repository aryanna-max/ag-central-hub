import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  useComplianceSummary,
  EMPRESA_LABELS,
} from "@/hooks/useComplianceSummary";
import { DOC_TYPE_LABELS } from "@/hooks/useEmployeeDocuments";

export default function CompanyDocsAlertCard() {
  const { data, isLoading } = useComplianceSummary();
  const navigate = useNavigate();
  if (isLoading || !data) return null;

  const { vencidos, vencendo30d, proximosVencimentos } = data.empresa;
  if (vencidos === 0 && vencendo30d === 0) return null;

  const headline =
    vencidos > 0
      ? `${vencidos} doc${vencidos > 1 ? "s" : ""} empresa vencido${vencidos > 1 ? "s" : ""}`
      : `${vencendo30d} doc${vencendo30d > 1 ? "s" : ""} empresa vencendo em 30 dias`;

  const preview = proximosVencimentos
    .slice(0, 3)
    .map(
      (d) =>
        `${EMPRESA_LABELS[d.empresa] ?? d.empresa}/${
          DOC_TYPE_LABELS[d.doc_type] ?? d.doc_type
        }`,
    )
    .join(", ");

  return (
    <Card className="border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-800">
      <CardContent className="p-4 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-red-900 dark:text-red-200">
            {headline}
          </p>
          {preview && (
            <p className="text-xs text-red-700 dark:text-red-300 mt-0.5">
              {preview}
              {proximosVencimentos.length > 3 ? "…" : ""}
            </p>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0"
          onClick={() => navigate("/base/governanca")}
        >
          Resolver
        </Button>
      </CardContent>
    </Card>
  );
}
