-- SITMAUD: comprobar la tasa vigente durante todo el día, no solo a las 18:30.
-- El token permanece en Supabase Vault: no se publica ninguna credencial.
select cron.schedule(
 'imaud-udc-daily-bcv-sync',
 '0 * * * *',
 $job$
 select net.http_post(
   url := 'https://vlgvojndrmvwhfjlpbid.supabase.co/functions/v1/sync-udc-bcv',
   headers := jsonb_build_object(
     'Content-Type','application/json',
     'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='imaud_udc_sync_anon_key'),
     'apikey',(select decrypted_secret from vault.decrypted_secrets where name='imaud_udc_sync_anon_key')
   ),
   body := '{}'::jsonb
 );
 $job$
);
