import { useMemo } from "react";
import { useUnresolvedAlerts, type Alert } from "./useAlerts";

const RECIPIENT_TO_MODULE: Record<string, string> = {
  financeiro: "/financeiro",
  operacional: "/operacional",
  comercial: "/comercial",
  rh: "/rh",
  sala_tecnica: "/sala-tecnica",
};

export function useModuleAlertCounts() {
  const { data: allAlerts = [] } = useAlerts();

  return useMemo(() => {
    const counts: Record<string, number> = {};
    allAlerts.forEach((a: Alert) => {
      if (a.resolved) return;
      const modulePath = RECIPIENT_TO_MODULE[a.recipient];
      if (modulePath) {
        counts[modulePath] = (counts[modulePath] || 0) + 1;
      }
      // "todos" counts for all modules
      if (a.recipient === "todos") {
        Object.values(RECIPIENT_TO_MODULE).forEach((p) => {
          counts[p] = (counts[p] || 0) + 1;
        });
      }
    });
    return counts;
  }, [allAlerts]);
}
