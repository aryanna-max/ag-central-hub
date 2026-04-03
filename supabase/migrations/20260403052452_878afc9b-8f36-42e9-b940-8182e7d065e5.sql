
-- Create a trigger function that calls the send-financial-alert edge function
-- via pg_net when a financial alert is inserted
CREATE OR REPLACE FUNCTION public.fn_notify_financial_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _supabase_url text;
  _service_role_key text;
  _request_id bigint;
BEGIN
  -- Only process alerts for financeiro
  IF NEW.recipient::text != 'financeiro' THEN
    RETURN NEW;
  END IF;

  -- Get Supabase URL and service role key from vault
  SELECT decrypted_secret INTO _supabase_url
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_url'
  LIMIT 1;

  SELECT decrypted_secret INTO _service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'supabase_service_role_key'
  LIMIT 1;

  -- If vault secrets not available, try env
  IF _supabase_url IS NULL THEN
    _supabase_url := current_setting('app.settings.supabase_url', true);
  END IF;

  IF _service_role_key IS NULL THEN
    _service_role_key := current_setting('app.settings.service_role_key', true);
  END IF;

  -- Call the edge function via pg_net
  IF _supabase_url IS NOT NULL AND _service_role_key IS NOT NULL THEN
    SELECT net.http_post(
      url := _supabase_url || '/functions/v1/send-financial-alert',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || _service_role_key
      ),
      body := jsonb_build_object(
        'record', row_to_json(NEW)
      )
    ) INTO _request_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger on alerts table
DROP TRIGGER IF EXISTS trg_notify_financial_alert ON public.alerts;
CREATE TRIGGER trg_notify_financial_alert
  AFTER INSERT ON public.alerts
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_notify_financial_alert();
