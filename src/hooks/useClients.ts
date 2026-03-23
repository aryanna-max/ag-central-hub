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
  created_at: string;
  updated_at: string;
}

export interface ClientInsert {
  name: string;
  cnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  segmento?: string | null;
  notes?: string | null;
  is_active?: boolean;
  lead_id?: string | null;
}

export interface ClientContact {
  id: string;
  client_id: string;
  contact_name: string;
  contact_phone: string | null;
  contact_email: string | null;
  role: string | null;
  is_primary: boolean;
  created_at: string;
}

export interface ClientContactInsert {
  client_id: string;
  contact_name: string;
  contact_phone?: string | null;
  contact_email?: string | null;
  role?: string | null;
  is_primary?: boolean;
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
  });
}

export function useClientContacts(clientId: string | undefined) {
  return useQuery({
    queryKey: ["client_contacts", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_contacts" as any)
        .select("*")
        .eq("client_id", clientId!)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return data as unknown as ClientContact[];
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
      const { data, error } = await supabase.from("client_contacts" as any).insert(contact as any).select().single();
      if (error) throw error;
      return data as unknown as ClientContact;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["client_contacts", vars.client_id] }),
  });
}

export function useDeleteClientContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, clientId }: { id: string; clientId: string }) => {
      const { error } = await supabase.from("client_contacts" as any).delete().eq("id", id);
      if (error) throw error;
      return clientId;
    },
    onSuccess: (clientId) => qc.invalidateQueries({ queryKey: ["client_contacts", clientId] }),
  });
}
