-- SITMAUD: unicidad real de identificación independentemente de guiones y puntos.
-- La cédula V/E conserva únicamente dígitos; el RIF J conserva letra y dígitos.
create unique index if not exists contributors_normalized_identity_unique
on public.contributors (
 identification_type,
 (case when identification_type in ('V','E')
    then regexp_replace(identification_number,'[^0-9]','','g')
    else regexp_replace(upper(identification_number),'[^A-Z0-9]','','g')
  end)
);
