-- =====================================================================
-- ADR-045 §0 (pré-requisito do agente RH) — parte 2/2
-- Inclui o papel 'rh' no mapa de fn_resolve_alert para que o agente RH
-- possa dar baixa em alertas destinados a recipient='rh'.
--
-- ÚNICA mudança em relação à versão do ADR-042 (PR #44): a linha do
-- CASE para recipient='rh' passa a incluir 'rh' no array de papéis.
-- Todo o resto do corpo é idêntico. create or replace, SECURITY INVOKER.
-- Depende do papel 'rh' criado em 20260811150000_...
-- =====================================================================

create or replace function public.fn_resolve_alert(
  p_alert_id   uuid,
  p_resolucao  text,
  p_origem_ref text default null
) returns jsonb
language plpgsql
set search_path to 'public'
as $$
declare
  v_alert   public.alerts%rowtype;
  v_roles   public.app_role[];
  v_tem_titulo boolean;
begin
  if coalesce(trim(p_resolucao),'') = '' then
    raise exception 'Informe o que foi feito para resolver o alerta (parâmetro resolucao).';
  end if;

  select * into v_alert from public.alerts where id = p_alert_id;
  if not found then
    raise exception 'Alerta % não encontrado.', p_alert_id;
  end if;

  -- Idempotente: já resolvido não é erro
  if v_alert.resolved then
    return jsonb_build_object(
      'ja_resolvido', true,
      'alerta_id', v_alert.id,
      'titulo', v_alert.title,
      'resolvido_em', v_alert.resolved_at
    );
  end if;

  -- Política: quem pode dar baixa depende do destinatário
  v_roles := case v_alert.recipient
    when 'operacional'  then array['master','diretor','operacional']::public.app_role[]
    when 'comercial'    then array['master','diretor','comercial']::public.app_role[]
    when 'financeiro'   then array['master','diretor','financeiro']::public.app_role[]
    when 'rh'           then array['master','diretor','financeiro','rh']::public.app_role[]
    when 'sala_tecnica' then array['master','diretor','sala_tecnica']::public.app_role[]
    when 'diretoria'    then array['master','diretor']::public.app_role[]
    else array['master','diretor','operacional','sala_tecnica','comercial','financeiro']::public.app_role[]
  end;

  if not public.has_any_role(auth.uid(), v_roles) then
    raise exception 'Sem permissão: alerta destinado a % exige papel compatível.', v_alert.recipient;
  end if;

  -- Política: alerta de emissão de documento exige o documento (Decisão #62)
  if v_alert.alert_type = 'entrega_concluida' and v_alert.reference_type = 'project' then
    select exists (
      select 1 from public.invoices i
      where i.project_id = v_alert.reference_id and i.status <> 'cancelada'
    ) into v_tem_titulo;

    if not v_tem_titulo then
      raise exception
        'Este alerta pede emissão de documento e não existe título para o projeto. Registre com create_titulo — o título resolve o alerta sozinho.';
    end if;
  end if;

  update public.alerts
     set resolved = true,
         resolved_at = now(),
         resolved_by_profile_id = auth.uid(),
         alert_status = 'resolvido',
         read = true
   where id = p_alert_id;

  perform public.log_event(
    'alert.resolved', 'alerts', p_alert_id,
    jsonb_build_object('alert_type', v_alert.alert_type, 'recipient', v_alert.recipient, 'resolucao', p_resolucao),
    jsonb_build_object('canal','mcp','ferramenta','resolve_alert','origem_ref', p_origem_ref)
  );

  return jsonb_build_object(
    'ja_resolvido', false,
    'alerta_id', v_alert.id,
    'titulo', v_alert.title,
    'tipo', v_alert.alert_type,
    'resolvido_em', now()
  );
end;
$$;
