import { useEmployeeComplianceCheck, useCriticalDocuments } from "@/hooks/useEmployeeDocuments";
import { AlertTriangle } from "lucide-react";

export function DocStatusBadge({ employeeId }: { employeeId: string }) {
  const { data: critical } = useCriticalDocuments();
  const hasIssue = (critical ?? []).some((d: any) => d.employee_id === employeeId);
  if (!hasIssue) return null;
  return (
    <span title="Documento vencido ou a vencer" className="inline-flex items-center text-red-500">
      <AlertTriangle className="w-3.5 h-3.5" />
    </span>
  );
}

export function ClientComplianceBadge({ employeeId, clientId }: { employeeId: string; clientId: string }) {
  const { data } = useEmployeeComplianceCheck(employeeId, clientId);
  if (!data || data.ok) return null;
  return (
    <span
      title={`Docs faltando: ${data.missing.map((m: any) => m.doc_type).join(", ")}`}
      className="inline-flex items-center text-red-500"
    >
      <AlertTriangle className="w-3.5 h-3.5" />
    </span>
  );
}
