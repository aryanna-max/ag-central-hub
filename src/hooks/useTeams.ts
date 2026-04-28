import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Team = Tables<"teams">;
export type TeamMember = Tables<"team_members">;
type TeamUpdate = TablesUpdate<"teams">;
type TeamMemberInsert = TablesInsert<"team_members">;

export function useTeams() {
  return useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teams")
        .select("*, team_members(*, employees(*)), vehicles:default_vehicle_id(id, model, plate, status), default_project:default_project_id(id, name)")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateTeamVehicle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, vehicleId }: { teamId: string; vehicleId: string | null }) => {
      const updates: TeamUpdate = { default_vehicle_id: vehicleId };
      const { error } = await supabase
        .from("teams")
        .update(updates)
        .eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
}

export function useUpdateTeamProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, projectId }: { teamId: string; projectId: string | null }) => {
      const updates: TeamUpdate = { default_project_id: projectId };
      const { error } = await supabase
        .from("teams")
        .update(updates)
        .eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
}

export function useCreateTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (team: { name: string; description?: string; leader_id?: string }) => {
      const { data, error } = await supabase
        .from("teams")
        .insert(team)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
}

export function useDeleteTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teams").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
}

export function useAddTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ team_id, employee_id, role }: { team_id: string; employee_id: string; role?: string }) => {
      const payload: TeamMemberInsert = { team_id, employee_id, role: role || "auxiliar" };
      const { data, error } = await supabase
        .from("team_members")
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
}

export function useRemoveTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["teams"] }),
  });
}
