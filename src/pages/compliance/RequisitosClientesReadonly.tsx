import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useClients } from "@/hooks/useClients";
import { useAllClientRequirements } from "@/hooks/useClientRequirements";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, Pencil } from "lucide-react";
import { DOC_TYPE_LABELS } from "@/hooks/useEmployeeDocuments";

export default function RequisitosClientesReadonly() {
  const { data: clients = [], isLoading: loadingClients } = useClients();
  const { data: allReqs = [], isLoading: loadingReqs } =
    useAllClientRequirements();

  const grouped = useMemo(() => {
    const map = new Map<string, typeof allReqs>();
    for (const r of allReqs) {
      const list = map.get(r.client_id) ?? [];
      list.push(r);
      map.set(r.client_id, list);
    }
    return clients
      .map((c) => ({ client: c, reqs: map.get(c.id) ?? [] }))
      .filter((g) => g.reqs.length > 0);
  }, [clients, allReqs]);

  if (loadingClients || loadingReqs) {
    return <p className="text-sm text-muted-foreground">Carregando…</p>;
  }

  if (grouped.length === 0) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Nenhum requisito de compliance cadastrado por cliente. Abra o
            perfil de um cliente em{" "}
            <Link to="/comercial/clientes" className="text-primary underline">
              /comercial/clientes
            </Link>{" "}
            e use a aba "Compliance" para configurar requisitos.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Visão consolidada (somente leitura). Para editar requisitos, abra o
        perfil do cliente em /comercial/clientes.
      </p>
      {grouped.map(({ client, reqs }) => (
        <Card key={client.id}>
          <CardHeader className="pb-3 flex flex-row items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              {client.name}
              {client.codigo && (
                <Badge variant="outline" className="font-mono text-xs">
                  {client.codigo}
                </Badge>
              )}
              <Badge variant="secondary" className="text-xs">
                {reqs.length} requisito{reqs.length === 1 ? "" : "s"}
              </Badge>
            </CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/comercial/clientes">
                <Pencil className="w-3.5 h-3.5 mr-1" /> Editar requisitos
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Documento</TableHead>
                  <TableHead>Mandatório</TableHead>
                  <TableHead>Validade (meses)</TableHead>
                  <TableHead>Observações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reqs.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">
                      {DOC_TYPE_LABELS[r.doc_type] ?? r.doc_type}
                    </TableCell>
                    <TableCell>
                      {r.is_mandatory ? (
                        <Badge>Sim</Badge>
                      ) : (
                        <Badge variant="outline">Não</Badge>
                      )}
                    </TableCell>
                    <TableCell>{r.validity_months ?? "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {r.notes ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
