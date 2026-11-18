import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SOURCE_URL = "https://bcv.today/api/v1/rate.json";
const CURRENCY_NAMES: Record<string, string> = {
  USD: "Dólar estadounidense",
  EUR: "Euro",
  CNY: "Yuan chino",
  TRY: "Lira turca",
  RUB: "Rublo ruso",
};

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "content-type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error("Supabase server environment is incomplete");
    }

    const sourceResponse = await fetch(SOURCE_URL, {
      headers: { "accept": "application/json", "cache-control": "no-cache" },
      signal: AbortSignal.timeout(15000),
    });
    if (!sourceResponse.ok) {
      throw new Error(`BCV rate source returned HTTP ${sourceResponse.status}`);
    }

    const source = await sourceResponse.json();
    const effectiveDate = String(source.effective_date || source.date || "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) {
      throw new Error("The BCV source did not return a valid effective date");
    }

    const rates: Record<string, number> = {};
    for (const [code, name] of Object.entries(CURRENCY_NAMES)) {
      const value = Number(source[code]);
      if (Number.isFinite(value) && value > 0) rates[code] = value;
    }
    if (!rates.USD || !rates.EUR || Object.keys(rates).length < 2) {
      throw new Error("The BCV source returned insufficient valid currency rates");
    }

    const caracasDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Caracas", year:"numeric", month:"2-digit", day:"2-digit" }).format(new Date());
    if (effectiveDate > caracasDate) throw new Error("Future effective dates require manual validation");
    const ageDays = (Date.parse(caracasDate + "T12:00:00Z") - Date.parse(effectiveDate + "T12:00:00Z")) / 86400000;
    if (!Number.isFinite(ageDays) || ageDays > 7) throw new Error("Exchange rates are more than seven days old");

    const [winnerCode, winnerValue] = Object.entries(rates)
      .sort((a, b) => b[1] - a[1])[0];
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: latest, error: latestError } = await supabase
      .from("udc_rates")
      .select("effective_date")
      .order("effective_date", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (latestError) throw latestError;

    if (latest?.effective_date && latest.effective_date > effectiveDate) {
      return Response.json({
        ok: false,
        skipped: true,
        reason: "The source returned an older effective date; the current UDC was preserved.",
        source_date: effectiveDate,
        stored_date: latest.effective_date,
      }, { status: 200 });
    }

    const publishedAtDate = source.updated_at ? new Date(source.updated_at) : null;
    if (publishedAtDate && !Number.isFinite(publishedAtDate.getTime())) throw new Error("Invalid source publication time");
    const publishedAt = publishedAtDate ? publishedAtDate.toISOString() : null;
    const record = {
      effective_date: effectiveDate,
      udc_currency_code: winnerCode,
      udc_currency_name: CURRENCY_NAMES[winnerCode],
      udc_value: winnerValue,
      rates_by_currency: rates,
      source_name: "BCV Today - réplica no oficial (verificar con BCV)",
      source_url: SOURCE_URL,
      source_published_at: publishedAt,
      fetched_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from("udc_rates")
      .upsert(record, { onConflict: "effective_date" })
      .select("effective_date,udc_currency_code,udc_currency_name,udc_value,rates_by_currency,fetched_at")
      .single();
    if (error) throw error;

    return Response.json({
      ok: true,
      message: "UDC synchronized from an unofficial third-party BCV rate replica; institutional verification required.",
      udc: data,
    }, { status: 200 });
  } catch (error) {
    console.error("udc-sync error:", error);
    return Response.json({
      ok: false,
      error: error instanceof Error ? error.message : "Unexpected synchronization error",
    }, { status: 502 });
  }
});