import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ContactType = "cliente" | "financeiro" | "engenheiro" | "outro";

export interface ProjectContact {
  id: string;
  project_id: string;
  tipo: ContactType;
  nome: string;
  telefone: string | null;
  email: string | null;
  notas: string | null;
  created_at: string;
}

export interface ProjectContactInsert {
  project_id: string;
  tipo: ContactType;
  nome: string;
  telefone?: string | null;
  email?: string | null;
  notas?: string | null;
}

export function useProjectContacts(projectId: string | null | undefined) {
  return useQuery({
    queryKey: ["project-contacts", projectId],
    queryFn: async () => {
      if (!projectId) return [];
      const { data, error } = await supabase
        .from("project_contacts")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ProjectContact[];
    },
    enabled: !!projectId,
  });
}

export function useUpsertProjectContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      projectId,
      contacts,
    }: {
      projectId: string;
      contacts: Omit<ProjectContactInsert, "project_id">[];
    }) => {
      // Delete existing contacts for this project
      await supabase
        .from("project_contacts")
        .delete()
        .eq("project_id", projectId);

      // Insert new contacts (skip empty names)
      const toInsert = contacts
        .filter((c) => c.nome.trim())
        .map((c) => ({
          project_id: projectId,
          tipo: c.tipo,
          nome: c.nome.trim(),
          telefone: c.telefone?.trim() || null,
          email: c.email?.trim() || null,
          notas: c.notas?.trim() || null,
        }));

      if (toInsert.length === 0) return [];

      const { data, error } = await supabase
        .from("project_contacts")
        .insert(toInsert)
        .select();
      if (error) throw error;
      return (data || []) as ProjectContact[];
    },
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["project-contacts", variables.projectId] });
    },
  });
}

export function useCreateProjectContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contacts: ProjectContactInsert[]) => {
      if (contacts.length === 0) return [];
      const { data, error } = await supabase
        .from("project_contacts")
        .insert(contacts)
        .select();
      if (error) throw error;
      return (data || []) as ProjectContact[];
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-contacts"] });
    },
  });
}
