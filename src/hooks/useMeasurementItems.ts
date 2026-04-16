import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MeasurementItem } from "./useMeasurements";

export function useMeasurementItems(measurementId: string | null) {
  return useQuery({
    queryKey: ["measurement-items", measurementId],
    queryFn: async () => {
      if (!measurementId) return [];
      const { data, error } = await supabase
        .from("measurement_items")
        .select("*")
        .eq("measurement_id", measurementId)
        .order("item_number");
      if (error) throw error;
      return data as unknown as MeasurementItem[];
    },
    enabled: !!measurementId,
  });
}

export function useCreateMeasurementItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: Omit<MeasurementItem, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("measurement_items")
        .insert(item as any)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as MeasurementItem;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["measurement-items", data.measurement_id] });
      qc.invalidateQueries({ queryKey: ["measurement-detail"] });
    },
  });
}

export function useUpdateMeasurementItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<MeasurementItem> & { id: string }) => {
      const { data, error } = await supabase
        .from("measurement_items")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data as unknown as MeasurementItem;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["measurement-items", data.measurement_id] });
      qc.invalidateQueries({ queryKey: ["measurement-detail"] });
    },
  });
}

export function useDeleteMeasurementItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, measurementId }: { id: string; measurementId: string }) => {
      const { error } = await supabase.from("measurement_items").delete().eq("id", id);
      if (error) throw error;
      return { measurementId };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["measurement-items", data.measurementId] });
      qc.invalidateQueries({ queryKey: ["measurement-detail"] });
    },
  });
}
