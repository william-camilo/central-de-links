// pin.ts — verificação do PIN com limite de tentativas (5 erros em 15 min bloqueiam por 15 min).
// deno-lint-ignore-file no-explicit-any
export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, x-pin",
};
export const jres = (o: unknown, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

const MAX_FAILS = 5;
const WINDOW_MIN = 15;

async function digest(s: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)));
}
async function sameSecret(a: string, b: string) {
  const [x, y] = await Promise.all([digest(a), digest(b)]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// Devolve null se o PIN confere; senão, a Response de erro (401 ou 429).
export async function checkPin(sb: any, req: Request): Promise<Response | null> {
  const since = new Date(Date.now() - WINDOW_MIN * 60 * 1000).toISOString();
  const { count } = await sb.from("admin_attempts").select("id", { count: "exact", head: true }).eq("scope", "pin").gt("at", since);
  if ((count ?? 0) >= MAX_FAILS) {
    return jres({ error: `Muitas tentativas erradas. Tente de novo em ${WINDOW_MIN} minutos.` }, 429);
  }
  const { data } = await sb.from("app_secrets").select("value").eq("key", "delete_pin").maybeSingle();
  const expected = data?.value ?? "";
  const pin = req.headers.get("x-pin") ?? "";
  if (!expected || !pin || !(await sameSecret(pin, expected))) {
    await sb.from("admin_attempts").insert({ scope: "pin" });
    const left = MAX_FAILS - (count ?? 0) - 1;
    return jres({ error: left > 0 ? `PIN inválido. Restam ${left} tentativa(s).` : `PIN inválido. Bloqueado por ${WINDOW_MIN} minutos.` }, 401);
  }
  // acertou: zera o contador de erros
  await sb.from("admin_attempts").delete().eq("scope", "pin");
  return null;
}

