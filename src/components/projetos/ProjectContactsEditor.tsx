import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import type { ContactType, ProjectContact } from "@/hooks/useProjectContacts";

const CONTACT_TYPE_LABELS: Record<ContactType, string> = {
  cliente: "Cliente",
  financeiro: "Financeiro",
  engenheiro: "Engenheiro",
  outro: "Outro",
};

export interface ContactRow {
  id?: string;
  tipo: ContactType;
  nome: string;
  telefone: string;
  email: string;
  fixed?: boolean; // fixed rows can't be removed
}

function emptyRow(tipo: ContactType, fixed = false): ContactRow {
  return { tipo, nome: "", telefone: "", email: "", fixed };
}

function contactsToRows(contacts: ProjectContact[]): ContactRow[] {
  const rows: ContactRow[] = [];
  const clienteContact = contacts.find((c) => c.tipo === "cliente");
  const financeiroContact = contacts.find((c) => c.tipo === "financeiro");

  // Fixed rows always present
  rows.push({
    id: clienteContact?.id,
    tipo: "cliente",
    nome: clienteContact?.nome || "",
    telefone: clienteContact?.telefone || "",
    email: clienteContact?.email || "",
    fixed: true,
  });
  rows.push({
    id: financeiroContact?.id,
    tipo: "financeiro",
    nome: financeiroContact?.nome || "",
    telefone: financeiroContact?.telefone || "",
    email: financeiroContact?.email || "",
    fixed: true,
  });

  // Additional contacts
  contacts
    .filter((c) => c.id !== clienteContact?.id && c.id !== financeiroContact?.id)
    .forEach((c) => {
      rows.push({
        id: c.id,
        tipo: c.tipo,
        nome: c.nome,
        telefone: c.telefone || "",
        email: c.email || "",
        fixed: false,
      });
    });

  return rows;
}

interface Props {
  contacts: ProjectContact[];
  onChange: (rows: ContactRow[]) => void;
  readOnly?: boolean;
}

export default function ProjectContactsEditor({ contacts, onChange, readOnly }: Props) {
  const [rows, setRows] = useState<ContactRow[]>(() => contactsToRows(contacts));

  useEffect(() => {
    setRows(contactsToRows(contacts));
  }, [contacts]);

  const updateRow = (index: number, field: keyof ContactRow, value: string) => {
    const next = rows.map((r, i) => (i === index ? { ...r, [field]: value } : r));
    setRows(next);
    onChange(next);
  };

  const addRow = () => {
    const next = [...rows, emptyRow("outro")];
    setRows(next);
    onChange(next);
  };

  const removeRow = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    setRows(next);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contatos</p>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          {row.fixed ? (
            <span className="text-xs font-medium text-muted-foreground w-24 shrink-0">
              {CONTACT_TYPE_LABELS[row.tipo]}
            </span>
          ) : (
            <Select
              value={row.tipo}
              onValueChange={(v) => updateRow(i, "tipo", v)}
              disabled={readOnly}
            >
              <SelectTrigger className="w-24 shrink-0 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(CONTACT_TYPE_LABELS) as ContactType[]).map((t) => (
                  <SelectItem key={t} value={t}>{CONTACT_TYPE_LABELS[t]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            placeholder="Nome"
            value={row.nome}
            onChange={(e) => updateRow(i, "nome", e.target.value)}
            className="h-8 text-sm flex-1 min-w-0"
            readOnly={readOnly}
          />
          <Input
            placeholder="Telefone"
            value={row.telefone}
            onChange={(e) => updateRow(i, "telefone", e.target.value)}
            className="h-8 text-sm w-36 shrink-0"
            readOnly={readOnly}
          />
          <Input
            placeholder="Email"
            value={row.email}
            onChange={(e) => updateRow(i, "email", e.target.value)}
            className="h-8 text-sm w-44 shrink-0"
            readOnly={readOnly}
          />
          {!row.fixed && !readOnly && (
            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeRow(i)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          )}
          {row.fixed && <div className="w-8 shrink-0" />}
        </div>
      ))}
      {!readOnly && (
        <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={addRow}>
          <Plus className="w-3.5 h-3.5" /> Adicionar contato
        </Button>
      )}
    </div>
  );
}
