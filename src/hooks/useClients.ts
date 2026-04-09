import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const SEGMENTOS = [
  "Construção Civil",
  "Saneamento",
  "Ambiental",
  "Mineração",
  "Agronegócio",
  "Órgão Público",
  "Outros",
] as const;

export interface Client {
  id: string;
  codigo: string | null;
  name: string;
  cnpj: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  segmento: string | null;
  tipo: string | null;
  contato_engenheiro: string | null;
  contato_financeiro: string | null;
  notes: string | null;
  is_active: boolean;
  lead_id: string | null;
  cep: string | null;
  rua: string | null;
  bairro: string | null;
  numero: string | null;
  cidade: string | null;
  estado: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientInsert {
  codigo?: string | null;
  name: string;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  segmento?: string | null;
  tipo?: string | null;
  contato_engenheiro?: string | null;
  contato_financeiro?: string | null;
  notes?: string | null;
  is_active?: boolean;
  lead_id?: string | null;
  cep?: string | null;
  rua?: string | null;
  bairro?: string | null;
  numero?: string | null;
  cidade?: string | null;
  estado?: string | null;
}

export interface ClientContact {
  id: string;
  client_id: string | null;
  project_id: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  cargo: string | null;
  area: string | null;
  tipo: string | null;
  notas: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface ClientContactInsert {
  client_id: string;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  cargo?: string | null;
  area?: string | null;
  tipo?: string | null;
  notas?: string | null;
}

export function useClients() {
  return useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return data as Client[];
    },
    staleTime: 0,
    refetchOnMount: "always",
  });
}

export function useClientContacts(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client_contacts", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contacts")
        .select("*")
        .eq("client_id", clientId!)
        .order("tipo", { ascending: true });
      if (error) throw error;
      return data as ClientContact[];
    },
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (client: ClientInsert) => {
      const { data, error } = await supabase.from("clients").insert(client).select().single();
      if (error) throw error;
      return data as Client;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Client> & { id: string }) => {
      const { data, error } = await supabase.from("clients").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return data as Client;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Verificar dependências antes de deletar
      const { count: projectCount } = await supabase
        .from("projects")
        .select("id", { count: "exact", head: true })
        .eq("client_id", id);
      if (projectCount && projectCount > 0) {
        throw new Error(`Cliente tem ${projectCount} projeto(s) vinculado(s). Remova os projetos primeiro.`);
      }
      const { count: leadCount } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("client_id", id);
      if (leadCount && leadCount > 0) {
        throw new Error(`Cliente tem ${leadCount} lead(s) vinculado(s). Remova os leads primeiro.`);
      }
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
}

export function useCreateClientContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contact: ClientContactInsert) => {
      const { data, error } = await supabase.from("client_contacts").insert(contact).select().single();
      if (error) throw error;
      return data as ClientContact;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["client_contacts", vars.client_id] }),
  });
}

export function useUpdateClientContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clientId, ...updates }: Partial<ClientContact> & { id: string; clientId: string }) => {
      const { data, error } = await supabase.from("client_contacts").update(updates).eq("id", id).select().single();
      if (error) throw error;
      return { data, clientId };
    },
    onSuccess: (result) => qc.invalidateQueries({ queryKey: ["client_contacts", result.clientId] }),
  });
}

export function useDeleteClientContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase.from("client_contacts").delete().eq("id", id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => qc.invalidateQueries({ queryKey: ["client_contacts", clientId] }),
  });
}
