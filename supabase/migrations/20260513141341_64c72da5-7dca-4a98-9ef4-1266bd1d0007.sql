
CREATE OR REPLACE FUNCTION public.fn_unvalidate_day_entry(
  p_entry_id uuid,
  p_motivo text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.daily_schedule_entries
     SET validated_at = NULL,
         validated_by_id = NULL,
         notes = COALESCE(notes,'') || E'\n[unvalidate] ' || COALESCE(p_motivo,'')
   WHERE id = p_entry_id;
END $$;
