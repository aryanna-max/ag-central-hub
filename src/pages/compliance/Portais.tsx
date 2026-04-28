import { ExternalLink, Globe, Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface Portal {
  nome: string;
  descricao: string;
  cliente: string;
  frequencia: string;
  url: string | null;
}

const PORTAIS: Portal[] = [
  {
    nome: "Alldocs (BRK)",
    descricao: "Envio de NFs e documentos de campo BRK",
    cliente: "BRK",
    frequencia: "Mensal — dia 20–25",
    url: null,
  },
  {
    nome: "SERTRAS (BRK)",
    descricao: "Compliance documental SERTRAS",
    cliente: "BRK",
    frequencia: "Por integração",
    url: null,
  },
  {
    nome: "Athier",
    descricao: "Portal Memorial Star",
    cliente: "Memorial Star",
    frequencia: "Mensal — dia 20",
    url: null,
  },
];

export default function Portais() {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 rounded-md border bg-muted/30">
        <Info className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Tracking automático virá em fase posterior. Por enquanto, esta página
          lista os portais externos relevantes. URLs aguardam confirmação
          (Aryanna preenche antes de mergear).
        </p>
      </div>

      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {PORTAIS.map((portal) => (
          <Card key={portal.nome}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Globe className="w-4 h-4 text-muted-foreground" />
                {portal.nome}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {portal.descricao}
              </p>
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                <Badge variant="secondary">{portal.cliente}</Badge>
                <Badge variant="outline">{portal.frequencia}</Badge>
              </div>
              {portal.url && (
                <Button
                  size="sm"
                  variant="outline"
                  asChild
                  className="w-full mt-1"
                >
                  <a
                    href={portal.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                    Abrir portal
                  </a>
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
