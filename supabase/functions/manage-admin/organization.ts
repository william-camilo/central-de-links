// Organização privada. O chamador deve validar o PIN antes de executar estas ações.
// deno-lint-ignore-file no-explicit-any
import { jres } from "./pin.ts";

export const MAX_BODY_BYTES = 4 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FOLDER_ID = /^[a-zA-Z0-9-]{1,80}$/;
type Metadata = { favorite: boolean; folder: string; tags: string[] };
type Organization = { version: 1; folders: { id: string; name: string }[]; links: Record<string, Metadata> };

export class InputError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

function record(value: unknown): value is Record<string, any> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

export function validateOrganization(value: unknown): Organization {
  if (!record(value) || value.version !== 1 || !Array.isArray(value.folders) || !record(value.links)) {
    throw new InputError("Organização inválida.");
  }
  if (value.folders.length > 200 || Object.keys(value.links).length > 20000) {
    throw new InputError("A organização excede o limite.");
  }
  const result: Organization = { version: 1, folders: [], links: Object.create(null) };
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const folder of value.folders) {
    if (!record(folder) || typeof folder.id !== "string" || !FOLDER_ID.test(folder.id) || ids.has(folder.id)
      || typeof folder.name !== "string" || !folder.name.trim() || folder.name.length > 60) {
      throw new InputError("Pasta inválida.");
    }
    const name = folder.name.trim();
    const normalized = name.normalize("NFC").toLocaleLowerCase("pt-BR");
    if (names.has(normalized)) throw new InputError("Já existe uma pasta com esse nome.");
    ids.add(folder.id); names.add(normalized);
    result.folders.push({ id: folder.id, name });
  }
  for (const [id, metadata] of Object.entries(value.links)) {
    if (!UUID.test(id) || !record(metadata) || typeof metadata.favorite !== "boolean"
      || typeof metadata.folder !== "string" || (metadata.folder !== "" && !ids.has(metadata.folder))
      || !Array.isArray(metadata.tags) || metadata.tags.length > 12
      || metadata.tags.some((tag: unknown) => typeof tag !== "string" || tag.length > 40)) {
      throw new InputError("Link, pasta ou tags inválidos.");
    }
    result.links[id] = {
      favorite: metadata.favorite, folder: metadata.folder,
      tags: [...new Set<string>(metadata.tags.map((tag: string) => tag.trim()).filter(Boolean))],
    };
  }
  return result;
}

// Limita também corpos enviados sem Content-Length; nunca materializa um corpo ilimitado.
export async function readBody(req: Request): Promise<Record<string, any>> {
  if (Number(req.headers.get("content-length")) > MAX_BODY_BYTES) throw new InputError("Requisição muito grande.", 413);
  const reader = req.body?.getReader();
  if (!reader) throw new InputError("JSON inválido.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BODY_BYTES) { await reader.cancel(); throw new InputError("Requisição muito grande.", 413); }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes));
    if (!record(value)) throw new Error();
    return value;
  } catch { throw new InputError("JSON inválido."); }
}

export async function organizationAction(sb: any, action: string, body: Record<string, any>): Promise<Response> {
  if (action === "organization_get") {
    const { data, error } = await sb.from("library_organization").select("data,revision").eq("id", true).single();
    if (error) throw error;
    return jres(data);
  }
  if (!Number.isSafeInteger(body.expected_revision) || body.expected_revision < 0 || body.expected_revision >= Number.MAX_SAFE_INTEGER) {
    throw new InputError("Revisão inválida.");
  }
  const organization = validateOrganization(body.data);
  const ids = Object.keys(organization.links);
  // Links excluídos em outro dispositivo não devem impedir os próximos salvamentos.
  // Só persistimos metadados associados a links processados que ainda existem.
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);
    const { data, error } = await sb.from("links").select("id").in("id", batch).eq("status", "processed");
    if (error) throw error;
    const existing = new Set((data ?? []).map((row: { id: string }) => row.id));
    for (const id of batch) if (!existing.has(id)) delete organization.links[id];
  }
  const { data, error } = await sb.from("library_organization").update({
    data: organization, revision: body.expected_revision + 1, updated_at: new Date().toISOString(),
  }).eq("id", true).eq("revision", body.expected_revision).select("data,revision").maybeSingle();
  if (error) throw error;
  if (!data) return jres({ error: "A organização mudou em outro dispositivo. Atualize e tente novamente." }, 409);
  return jres(data);
}
