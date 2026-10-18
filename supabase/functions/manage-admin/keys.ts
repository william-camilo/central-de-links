// keys.ts — rodízio de chaves Gemini + classificação de categoria (compartilhado entre funções).
// Quando uma chave esgota a cota (429) ou é inválida, passa automaticamente para a próxima.
// deno-lint-ignore-file no-explicit-any
export const GEM = "https://generativelanguage.googleapis.com";
export const MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-lite-latest"];

export type ErrKind = "day" | "minute" | "invalid" | "model" | "transient";

function classify(status: number, body: string): ErrKind {
  if (status === 429) return /PerDay|per day|daily/i.test(body) ? "day" : "minute";
  if (status === 400 && /API_KEY_INVALID|API key not valid|API key expired/i.test(body)) return "invalid";
  if (status === 401) return "invalid";
  if (status === 403 && /suspended|leaked|API key|API_KEY|has not been used|disabled/i.test(body)) return "invalid";
  if (status === 404) return "model";
  return "transient";
}

export class GeminiError extends Error {
  status: number; kind: ErrKind; retryAfterSec?: number;
  constructor(status: number, body: string, model = "", kind?: ErrKind) {
    super(`${model} ${status} ${body}`.trim().replace(/\s+/g, " ").slice(0, 300));
    this.status = status;
    this.kind = kind ?? classify(status, body);
    const m = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
    if (m) this.retryAfterSec = Math.ceil(Number(m[1]));
  }
}

export async function generate(apiKey: string, model: string, parts: unknown[], cfg: Record<string, unknown> = {}, timeoutMs = 60000) {
  let res: Response, text: string;
  try {
    res = await fetch(`${GEM}/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({ contents: [{ parts }], generationConfig: { temperature: 0.2, responseMimeType: "application/json", ...cfg } }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    text = await res.text();
  } catch (e) { throw new GeminiError(0, String(e), model, "transient"); }
  if (!res.ok) throw new GeminiError(res.status, text, model);
  try {
    const data = JSON.parse(text);
    const out = (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
    const clean = out.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
    return { json: JSON.parse(clean), tokens: data?.usageMetadata?.totalTokenCount ?? 0, model };
  } catch (_e) { throw new GeminiError(200, "resposta sem JSON válido", model, "transient"); }
}

// Tenta cada modelo com a MESMA chave; devolve o erro mais representativo se todos falharem.
export async function tryModels<T>(fn: (model: string) => Promise<T>, models = MODELS): Promise<T> {
  const errs: GeminiError[] = [];
  for (const m of models) {
    try { return await fn(m); } catch (e) {
      const ge = e instanceof GeminiError ? e : new GeminiError(0, String(e), m, "transient");
      errs.push(ge);
      if (ge.kind === "invalid") break;
    }
  }
  const inv = errs.find((e) => e.kind === "invalid");
  if (inv) throw inv;
  const relevant = errs.filter((e) => e.kind !== "model");
  const quota = relevant.filter((e) => e.kind === "day" || e.kind === "minute");
  if (quota.length && quota.length === relevant.length) throw quota.find((e) => e.kind === "minute") ?? quota[0];
  throw errs[errs.length - 1] ?? new GeminiError(0, "nenhum modelo disponível", "", "transient");
}

interface KeyRow { id: string; label: string; api_key: string }

function nextDailyReset(): string {
  // a cota diária gratuita do Gemini zera à meia-noite do horário do Pacífico (07h–08h UTC)
  const now = new Date();
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 8, 5));
  if (t.getTime() <= now.getTime()) t.setUTCDate(t.getUTCDate() + 1);
  return t.toISOString();
}

async function secretOf(sb: any, k: string): Promise<string | null> {
  const { data } = await sb.from("app_secrets").select("value").eq("key", k).maybeSingle();
  return data?.value ?? null;
}

async function notify(sb: any, text: string) {
  try {
    const token = await secretOf(sb, "telegram_bot_token");
    const chat = (await secretOf(sb, "allowed_chat_ids"))?.split(",")[0]?.trim();
    if (!token || !chat) return;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, parse_mode: "HTML" }),
    });
  } catch (_e) { /* aviso é opcional */ }
}

export async function availableKeys(sb: any): Promise<KeyRow[]> {
  await sb.from("api_keys").update({ status: "active", exhausted_until: null })
    .eq("provider", "gemini").eq("status", "exhausted").lte("exhausted_until", new Date().toISOString());
  const { data } = await sb.from("api_keys").select("id,label,api_key")
    .eq("provider", "gemini").eq("enabled", true).eq("status", "active")
    .order("priority", { ascending: true }).order("created_at", { ascending: true });
  if (data?.length) return data;
  const { count } = await sb.from("api_keys").select("id", { count: "exact", head: true }).eq("provider", "gemini");
  if (!count) {
    const legacy = await secretOf(sb, "gemini_api_key");
    if (legacy) return [{ id: "legacy", label: "Chave original", api_key: legacy }];
  }
  return [];
}

async function markKey(sb: any, k: KeyRow, ge: GeminiError, nextLabel?: string) {
  if (k.id === "legacy") return;
  const base = { last_error: ge.message.slice(0, 300), last_error_at: new Date().toISOString() };
  if (ge.kind === "day" || ge.kind === "minute") {
    const until = ge.kind === "day" ? nextDailyReset() : new Date(Date.now() + Math.max(ge.retryAfterSec ?? 0, 60) * 1000).toISOString();
    const { data } = await sb.from("api_keys").update({ ...base, status: "exhausted", exhausted_until: until }).eq("id", k.id).eq("status", "active").select("id");
    if (data?.length && ge.kind === "day") {
      await notify(sb, `🔑 A chave <b>${k.label}</b> esgotou a cota de hoje.${nextLabel ? ` Passei para <b>${nextLabel}</b>.` : " ⚠️ Não há outra chave ativa — cadastre mais uma no app (Configurações)."}`);
    }
  } else if (ge.kind === "invalid") {
    const { data } = await sb.from("api_keys").update({ ...base, status: "invalid" }).eq("id", k.id).neq("status", "invalid").select("id");
    if (data?.length) await notify(sb, `🔑 A chave <b>${k.label}</b> foi recusada pelo Google (inválida ou suspensa).${nextLabel ? ` Passei para <b>${nextLabel}</b>.` : ""}`);
  } else {
    await sb.from("api_keys").update(base).eq("id", k.id);
  }
}

// Executa `work` com a primeira chave disponível; se falhar por cota/chave, troca para a próxima.
export async function withKeys<T>(sb: any, work: (apiKey: string) => Promise<T>):
  Promise<{ ok: true; value: T; keyLabel: string } | { ok: false; error: string }> {
  const keys = await availableKeys(sb);
  if (!keys.length) return { ok: false, error: "nenhuma chave de API disponível (todas esgotadas, inválidas ou desativadas)" };
  const errors: string[] = [];
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    try {
      const value = await work(k.api_key);
      if (k.id !== "legacy") await sb.rpc("api_key_touch", { p_id: k.id });
      return { ok: true, value, keyLabel: k.label };
    } catch (e) {
      const ge = e instanceof GeminiError ? e : new GeminiError(0, String(e), "", "transient");
      errors.push(`${k.label}: ${ge.message}`);
      await markKey(sb, k, ge, keys[i + 1]?.label);
    }
  }
  return { ok: false, error: errors.join(" | ").slice(0, 600) };
}

export async function testKey(apiKey: string) {
  try {
    const r = await tryModels((m) => generate(apiKey, m, [{ text: 'Responda apenas este JSON: {"ok": true}' }], {}, 20000));
    return { ok: true as const, detail: `respondeu (${r.model})` };
  } catch (e) {
    const ge = e instanceof GeminiError ? e : new GeminiError(0, String(e), "", "transient");
    return { ok: false as const, kind: ge.kind, detail: ge.message };
  }
}

// ---------------- categoria: lista fechada + confiança ----------------
export const REVIEW_BELOW = 0.7;   // abaixo disso, vai para "Revisar"
export const AUTO_MOVE_AT = 0.85;  // reclassificação pós-vídeo só move sozinha acima disso
export const PALETTE = ["#7C9CFF", "#2DD4BF", "#FBBF24", "#34D399", "#A78BFA", "#F472B6", "#60A5FA", "#FB923C"];
export const norm = (s: string) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const pct = (c: number) => `${Math.round(c * 100)}%`;

export interface Cat { id: string; name: string }

export function categoryFields(names: string[]) {
  return {
    category: names.length ? { type: "STRING", enum: names } : { type: "STRING" },
    confidence: { type: "NUMBER" },
    better_category: { type: "STRING", nullable: true },
  };
}

export const CATEGORY_RULES = `Regras de categoria:
- "category": escolha EXATAMENTE uma das categorias existentes (a que melhor serve).
- "confidence": número de 0 a 1 com sua certeza real de que é a melhor categoria. Seja calibrado: use menos de 0.7 se ficou em dúvida entre duas.
- "better_category": null na maioria dos casos. Só preencha com um nome curto (até 3 palavras) de um tema NOVO se nenhuma categoria existente servir de verdade.`;

export function categoryPrompt(info: { title?: string | null; summary?: string | null; caption?: string | null; transcript?: string | null; screen_text?: unknown; tools?: unknown; current?: string | null }, names: string[]) {
  const arr = (v: unknown) => Array.isArray(v) ? v.slice(0, 25).join(" | ") : "";
  return `Classifique este conteúdo salvo por um usuário brasileiro numa das categorias que ele já tem.
Categorias existentes: ${names.join(", ")}
Categoria atual (pode estar errada): ${info.current ?? "(nenhuma)"}

Título: ${info.title ?? ""}
Resumo: ${(info.summary ?? "").slice(0, 1200)}
Legenda: ${(info.caption ?? "").slice(0, 800)}
Fala do vídeo (trecho): ${(info.transcript ?? "").slice(0, 3000)}
Textos na tela: ${arr(info.screen_text).slice(0, 800)}
Ferramentas citadas: ${arr(info.tools).slice(0, 400)}

${CATEGORY_RULES}
Responda SOMENTE o JSON {"category": "...", "confidence": 0.0, "better_category": null}.`;
}

export function parseDecision(raw: any, cats: Cat[]) {
  const rawName = String(raw?.category ?? "").trim();
  const cat = cats.find((c) => norm(c.name) === norm(rawName)) ?? null;
  let confidence = Number(raw?.confidence);
  if (!isFinite(confidence)) confidence = 0.5;
  if (confidence > 1 && confidence <= 100) confidence = confidence / 100;
  confidence = Math.max(0, Math.min(1, confidence));
  let better: string | null = raw?.better_category ? String(raw.better_category).trim().slice(0, 60) : null;
  if (better && (/^(null|nenhum|nenhuma|n\/a|-)$/i.test(better) || cats.some((c) => norm(c.name) === norm(better!)))) better = null;
  return { cat, rawName, confidence, better };
}

// mode: "initial" (link novo: aplica a categoria) | "auto" (pós-vídeo: só move se confiança alta) | "suggest" (só sugere)
export async function applyDecision(sb: any, link: { id: string; category_id: string | null; category_locked?: boolean | null },
  cats: Cat[], d: ReturnType<typeof parseDecision>, mode: "initial" | "auto" | "suggest") {
  if (link.category_locked && mode !== "initial") return { moved: false, flagged: false, skipped: true };
  const patch: Record<string, unknown> = { category_confidence: d.confidence, recategorized_at: new Date().toISOString() };
  const reasons: string[] = [];
  let pending: string | null = null;
  let moved = false;
  let target = d.cat;

  if (!cats.length && mode === "initial") {
    // primeira categoria do app: cria direto
    const { data: c } = await sb.from("categories").insert({ name: d.better || d.rawName || "Geral", color: PALETTE[0] }).select("id,name").single();
    if (c) { patch.category_id = c.id; moved = true; }
  } else if (!target && mode === "initial") {
    target = cats[0];
    reasons.push(`categoria "${d.rawName}" não reconhecida`);
  }
  if (target && target.id !== link.category_id) {
    if (mode === "initial" || (mode === "auto" && d.confidence >= AUTO_MOVE_AT)) { patch.category_id = target.id; moved = true; }
    else { pending = target.name; reasons.push(`a IA sugere mover para "${target.name}" (${pct(d.confidence)})`); }
  }
  if (d.confidence < REVIEW_BELOW) reasons.push(`confiança baixa (${pct(d.confidence)})`);
  if (d.better) { pending = d.better; reasons.push(`sugere criar o tema "${d.better}"`); }

  patch.needs_review = reasons.length > 0;
  patch.pending_category = pending;
  patch.review_reason = reasons.length ? reasons.join("; ") : null;
  await sb.from("links").update(patch).eq("id", link.id);
  return { moved, flagged: reasons.length > 0, pending, reason: patch.review_reason as string | null, to: moved ? (target?.name ?? null) : null };
}

