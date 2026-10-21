const test = require('node:test');
const assert = require('node:assert/strict');
const { parse, collect } = require('../github-library.js');

test('canonical repository and clone URLs; rejects profiles and hostile URLs', () => {
  for (const value of ['https://github.com/Owner/Repo.git?tab=readme#intro', 'github.com/Owner/Repo/tree/main/src', 'https://www.github.com/Owner/Repo/']) {
    assert.deepEqual(parse(value), { key: 'owner/repo', name: 'Owner/Repo', url: 'https://github.com/Owner/Repo', cloneUrl: 'https://github.com/Owner/Repo.git' });
  }
  for (const value of ['https://github.com/org', 'https://github.com/topics/ai', 'https://github.com/orgs/example/repositories', 'https://github.com.evil.test/a/b', 'https://github.com@evil.test/a/b', 'https://user:token@github.com/a/b', 'javascript:alert(1)', 'https://github.com/a/%2e%2e', 'https://github.com/a/b;curl', 'https://gitlab.com/a/b']) assert.equal(parse(value), null, value);
});

test('collects Telegram repositories and references once, preferring their own summary', () => {
  const records = [
    { id: 'video', category_id: 'general', summary: 'Alpha cria agentes. Beta organiza PDFs.', cited_links: [{ url: 'https://github.com/team/Alpha' }, { url: 'https://github.com/team/Beta' }] },
    { id: 'direct', category_id: 'agents', raw_url: 'https://github.com/TEAM/alpha.git', normalized_url: 'github.com/TEAM/alpha', summary: 'Cria agentes locais para automatizar tarefas.', summary_inferred: false },
    { id: 'profile', raw_url: 'https://github.com/team', category_id: 'general' },
  ];
  const repos = collect(records);
  assert.equal(repos.length, 2);
  const alpha = repos.find(r => r.key === 'team/alpha');
  assert.equal(alpha.categoryId, 'agents');
  assert.equal(alpha.summary, records[1].summary);
  assert.equal(alpha.sourceId, 'direct');
  assert.equal(alpha.sources.length, 2);
  assert.equal(repos.find(r => r.key === 'team/beta').summary, 'Beta organiza PDFs.');
  records.push({ id: 'new', raw_url: 'https://github.com/other/new', summary: 'Novo repositório.' });
  assert.equal(collect(records).length, 3);
});

test('keeps missing descriptions honest and reads explicit URLs in captions', () => {
  const repos = collect([{ id: 'source', summary: 'Uma lista de projetos.', caption: 'https://github.com/team/one e https://github.com/team/two', cited_links: [] }]);
  assert.equal(repos.length, 2);
  assert.equal(repos[0].summary, '');
  assert.equal(repos[0].categoryId, '__uncategorized');
  const generic = collect([{ id: 'skills', summary: 'O post apresenta skills populares de marketing.', cited_links: [{url:'https://github.com/anthropics/skills'}, {url:'https://github.com/team/marketing'}] }]);
  assert.equal(generic.find(r=>r.key==='anthropics/skills').summary,'');
});
