-- SITMAUD: toda alta de contribuyentes debe pasar por el servidor institucional
-- para solicitar activación por correo; se mantienen consultas y ediciones autorizadas.
revoke insert on public.contributors from anon,authenticated;
