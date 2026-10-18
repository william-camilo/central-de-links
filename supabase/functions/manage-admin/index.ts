// manage-admin v1 — painel do app (protegido por PIN): chaves de API e revisão de categorias.
// A chave completa NUNCA volta para o navegador; a lista mostra só o final dela.
// deno-lint-ignore-file no-explicit-any
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { CORS, jres, checkPin } from "./pin.ts";
import { testKey, PALETTE, norm } from "./keys.ts";
import { InputError, readBody, organizationAction } from "./organization.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const sb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
const MAX_KEYS = 10;

const mask = (k: string) => (k.length > 10 ? `${k.slice(0, 4)}…${k.slice(-4)}` : "••••");

async function listKeys() {
  const { data } = await sb.from("api_keys").select("id,label,api_key,priority,enabled,status,exhausted_until,uses,last_used_at,last_error,last_error_at,created_at")
    .eq("provider", "gemini").order("priority").order("created_at");
  const now = Date.now();
  return (data ?? []).map((k: any) => ({
    id: k.id, label: k.label, masked: mask(k.api_key), priority: k.priority, enabled: k.enabled,
    status: k.status === "exhausted" && k.exhausted_until && new Date(k.exhausted_until).getTime() <= now ? "active" : k.status,
    exhausted_until: k.exhausted_until, uses: k.uses, last_used_at: k.last_used_at,
    last_error: k.last_error, last_error_at: k.last_error_at,
  }));
}

async function moveLink(id: string, categoryId: string) {
  const { error } = await sb.from("links").update({
    category_id: categoryId, category_locked: true, needs_review: false, pending_category: null, review_reason: null,
  }).eq("id", id);
  if (error) throw error;
}

async function ensureCategory(name: string): Promise<string> {
  const { data: cats } = await sb.from("categories").select("id,name");
  const found = (cats ?? []).find((c: any) => norm(c.name) === norm(name));
  if (found) return found.id;
  const color = PALETTE[(cats?.length ?? 0) % PALETTE.length];
  const { data, error } = await sb.from("categories").insert({ name: name.trim().slice(0, 60), color }).select("id").single();
  if (error) throw error;
  return data.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return new Response("method not allowed", { status: 405, headers: CORS });

  const denied = await checkPin(sb, req);
  if (denied) return denied;

  let action = "";
  try {
    const b = await readBody(req);
    action = String(b?.action ?? "");
    switch (action) {
      case "organization_get":
      case "organization_save":
        return await organizationAction(sb, action, b);

      case "ping":
        return jres({ ok: true });

      // ---------- chaves ----------
      case "keys_list":
        return jres({ ok: true, keys: await listKeys() });

      case "keys_add": {
        const key = String(b.api_key ?? "").trim();
        const label = String(b.label ?? "").trim().slice(0, 40);
        if (!/^[A-Za-z0-9_.\-]{20,300}$/.test(key)) return jres({ error: "Isso não parece uma chave de API do Google (AI Studio)." }, 400);
        const { count } = await sb.from("api_keys").select("id", { count: "exact", head: true }).eq("provider", "gemini");
        if ((count ?? 0) >= MAX_KEYS) return jres({ error: `Limite de ${MAX_KEYS} chaves.` }, 400);
        const t = await testKey(key);
        if (!t.ok && t.kind === "invalid") return jres({ error: `O Google recusou essa chave: ${t.detail}` }, 400);
        const { data: last } = await sb.from("api_keys").select("priority").eq("provider", "gemini").order("priority", { ascending: false }).limit(1).maybeSingle();
        const row: Record<string, unknown> = {
          provider: "gemini", api_key: key, label: label || `Chave ${(count ?? 0) + 1}`,
          priority: (last?.priority ?? 0) + 1,
        };
        if (!t.ok && (t.kind === "day" || t.kind === "minute")) {
          row.status = "exhausted";
          row.exhausted_until = new Date(Date.now() + (t.kind === "day" ? 12 * 3600 : 120) * 1000).toISOString();
          row.last_error = t.detail;
        }
        const { error } = await sb.from("api_keys").insert(row);
        if (error) {
          if ((error as any).code === "23505") return jres({ error: "Essa chave já está cadastrada." }, 409);
          throw error;
        }
        return jres({ ok: true, test: t, keys: await listKeys() });
      }

      case "keys_test": {
        const { data: k } = await sb.from("api_keys").select("id,api_key").eq("id", b.id).maybeSingle();
        if (!k) return jres({ error: "Chave não encontrada." }, 404);
        const t = await testKey(k.api_key);
        const patch: Record<string, unknown> = t.ok
          ? { status: "active", exhausted_until: null, last_error: null }
          : t.kind === "invalid"
          ? { status: "invalid", last_error: t.detail, last_error_at: new Date().toISOString() }
          : t.kind === "day" || t.kind === "minute"
          ? { status: "exhausted", exhausted_until: new Date(Date.now() + (t.kind === "day" ? 12 * 3600 : 120) * 1000).toISOString(), last_error: t.detail, last_error_at: new Date().toISOString() }
          : { last_error: t.detail, last_error_at: new Date().toISOString() };
        await sb.from("api_keys").update(patch).eq("id", k.id);
        return jres({ ok: true, test: t, keys: await listKeys() });
      }

      case "keys_toggle": {
        const { error } = await sb.from("api_keys").update({ enabled: !!b.enabled }).eq("id", b.id);
        if (error) throw error;
        return jres({ ok: true, keys: await listKeys() });
      }

      case "keys_first": {
        const { data: first } = await sb.from("api_keys").select("priority").eq("provider", "gemini").order("priority").limit(1).maybeSingle();
        await sb.from("api_keys").update({ priority: (first?.priority ?? 1) - 1 }).eq("id", b.id);
        return jres({ ok: true, keys: await listKeys() });
      }

      case "keys_remove": {
        const { count } = await sb.from("api_keys").select("id", { count: "exact", head: true }).eq("provider", "gemini");
        if ((count ?? 0) <= 1) return jres({ error: "Não dá para remover a última chave: o app ficaria sem IA." }, 400);
        const { error } = await sb.from("api_keys").delete().eq("id", b.id);
        if (error) throw error;
        return jres({ ok: true, keys: await listKeys() });
      }

      // ---------- revisão de categorias ----------
      case "review_accept": {
        const { data: l } = await sb.from("links").select("id,pending_category").eq("id", b.id).maybeSingle();
        if (!l) return jres({ error: "Link não encontrado." }, 404);
        if (!l.pending_category) {
          await sb.from("links").update({ needs_review: false, review_reason: null, category_locked: true }).eq("id", l.id);
          return jres({ ok: true });
        }
        const catId = await ensureCategory(l.pending_category);
        await moveLink(l.id, catId);
        return jres({ ok: true, category_id: catId });
      }

      case "review_keep": {
        const { error } = await sb.from("links").update({ needs_review: false, pending_category: null, review_reason: null, category_locked: true }).eq("id", b.id);
        if (error) throw error;
        return jres({ ok: true });
      }

      case "review_move": {
        let catId = String(b.category_id ?? "");
        if (!catId && b.new_category) catId = await ensureCategory(String(b.new_category));
        if (!catId) return jres({ error: "Escolha a categoria." }, 400);
        await moveLink(String(b.id), catId);
        return jres({ ok: true, category_id: catId });
      }

      case "recat_start": {
        const { data } = await sb.from("app_secrets").select("value").eq("key", "internal_key").maybeSingle();
        const r = await fetch(`${SUPABASE_URL}/functions/v1/video-worker?a=recategorize&limit=20&chain=10`, { method: "POST", headers: { "x-internal-key": data?.value ?? "" } });
        return jres({ ok: r.ok });
      }

      default:
        return jres({ error: "ação inválida" }, 400);
    }
  } catch (e) {
    if (e instanceof InputError) return jres({ error: e.message }, e.status);
    console.error("manage-admin", action, e);
    return jres({ error: String((e as any)?.message ?? e) }, 500);
  }
});

