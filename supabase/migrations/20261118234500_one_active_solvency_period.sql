-- Restringe concurrencia: un único certificado vigente por contribuyente y período.
create unique index if not exists solvency_one_issued_per_contributor_period
on public.solvency_certificates(contributor_id,period_start,period_end)
where status='issued';