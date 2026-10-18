import test from 'node:test';
import assert from 'node:assert/strict';
import { validateOrganization, readBody, organizationAction, MAX_BODY_BYTES } from '../supabase/functions/manage-admin/organization.ts';

const link = '11111111-1111-4111-8111-111111111111';
const deleted = '22222222-2222-4222-8222-222222222222';
const input = () => ({ version: 1, folders: [{ id: 'research', name: ' Pesquisa ' }], links: {
  [link]: { favorite: true, folder: 'research', tags: [' IA ', 'IA', ''] },
} });

test('validates, normalizes and strips unexpected fields', () => {
  const value = input();
  value.secret = 'ignored';
  const result = validateOrganization(value);
  assert.equal(result.folders[0].name, 'Pesquisa');
  assert.deepEqual(result.links[link].tags, ['IA']);
  assert.equal(Object.getPrototypeOf(result.links), null);
  assert.equal(result.secret, undefined);
});

test('rejects malformed data and dangling folder references', () => {
  for (const change of [
    v => { v.version = 2; }, v => { v.links = []; },
    v => { v.folders.push({ id: 'research', name: 'Outra' }); },
    v => { v.folders.push({ id: 'other', name: 'pesquisa' }); },
    v => { v.links[link].folder = 'missing'; },
    v => { v.links[link].favorite = 'true'; },
    v => { v.links[link].tags = ['x'.repeat(41)]; },
    v => { v.links[link].tags = Array(13).fill('x'); },
    v => { v.links['constructor'] = v.links[link]; },
    v => { v.folders[0].name = ' '; },
  ]) {
    const value = input(); change(value);
    assert.throws(() => validateOrganization(value), { status: 400 });
  }
});

test('bounds streamed request bodies and rejects invalid JSON', async () => {
  const request = text => new Request('https://example.test', { method: 'POST', body: text });
  assert.deepEqual(await readBody(request('{"action":"organization_get"}')), { action: 'organization_get' });
  await assert.rejects(() => readBody(request('[]')), { status: 400 });
  await assert.rejects(() => readBody(request('{')), { status: 400 });
  await assert.rejects(() => readBody(request('x'.repeat(MAX_BODY_BYTES + 1))), { status: 413 });
});

function database() {
  let row = { data: { version: 1, folders: [], links: {} }, revision: 0 };
  return {
    row: () => structuredClone(row),
    from(table) {
      let patch, revision, ids;
      const builder = {
        select() { return builder; },
        eq(key, value) { if (key === 'revision') revision = value; return builder; },
        in(key, value) { ids = value; return builder; },
        update(value) { patch = value; return builder; },
        single() { return Promise.resolve({ data: structuredClone(row), error: null }); },
        maybeSingle() {
          if (revision !== row.revision) return Promise.resolve({ data: null, error: null });
          row = { data: patch.data, revision: patch.revision };
          return Promise.resolve({ data: structuredClone(row), error: null });
        },
        then(resolve) {
          assert.equal(table, 'links');
          return Promise.resolve({ data: ids.filter(id => id === link).map(id => ({ id })), error: null }).then(resolve);
        },
      };
      return builder;
    },
  };
}

test('two devices cannot overwrite the same revision; removed links are pruned', async () => {
  const sb = database();
  const value = input();
  value.links[deleted] = { favorite: true, folder: '', tags: [] };
  const first = await organizationAction(sb, 'organization_get', {});
  assert.equal((await first.json()).revision, 0);
  const responses = await Promise.all([
    organizationAction(sb, 'organization_save', { data: value, expected_revision: 0 }),
    organizationAction(sb, 'organization_save', { data: input(), expected_revision: 0 }),
  ]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal(sb.row().revision, 1);
  assert.equal(sb.row().data.links[deleted], undefined);
  const secondDevice = await organizationAction(sb, 'organization_get', {});
  assert.equal((await secondDevice.json()).data.folders[0].name, 'Pesquisa');
  await assert.rejects(() => organizationAction(sb, 'organization_save', { data: input(), expected_revision: -1 }), { status: 400 });
});

test('database failures never become a successful response', async () => {
  const sb = { from() { return { select() { return this; }, eq() { return this; }, single() { return { error: new Error('unavailable') }; } }; } };
  await assert.rejects(() => organizationAction(sb, 'organization_get', {}), /unavailable/);
});
