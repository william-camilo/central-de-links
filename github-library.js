(function(root){
  'use strict';
  const reserved = new Set('about apps codespaces collections contact customer-stories dashboard enterprise events explore features issues login marketplace new notifications orgs organizations pricing pulls readme search security settings signup site sponsors topics users'.split(' '));
  function parse(value){
    try {
      let text = String(value || '').trim();
      if (/^(www\.)?github\.com\//i.test(text)) text = 'https://' + text;
      const url = new URL(text);
      if (!/^https?:$/.test(url.protocol) || !/^(www\.)?github\.com$/i.test(url.hostname) || url.username || url.password || url.port) return null;
      const parts = url.pathname.split('/').filter(Boolean), owner = parts[0], repo = (parts[1] || '').replace(/\.git$/i, '');
      if (!owner || reserved.has(owner.toLowerCase()) || !/^[a-z0-9](?:[a-z0-9-]{0,37}[a-z0-9])?$/i.test(owner)
        || !/^[a-z0-9_.-]{1,100}$/i.test(repo) || /^\.+$/.test(repo)) return null;
      const name = owner + '/' + repo, canonical = 'https://github.com/' + name;
      return { key: name.toLowerCase(), name, url: canonical, cloneUrl: canonical + '.git' };
    } catch { return null; }
  }
  function collect(links){
    const repos = new Map();
    for (const link of links){
      const direct = parse(link.raw_url) || parse(link.normalized_url);
      const text = [link.caption, link.summary, link.transcript].filter(Boolean).join('\n');
      const embedded = text.match(/https?:\/\/(?:www\.)?github\.com\/[^\s<>"')\]]+/gi) || [];
      const candidates = [link.raw_url, link.normalized_url, ...(link.cited_links || []).map(c => c.url), ...embedded]
        .map(value => parse(typeof value === 'string' ? value.replace(/[.,;:!?]+$/, '') : '')).filter(Boolean);
      const unique = new Map(candidates.map(repo => [repo.key, repo]));
      for (const repo of unique.values()){
        const own = direct?.key === repo.key;
        const name = repo.name.split('/')[1].toLowerCase();
        let summary = '';
        if (own || unique.size === 1) summary = String(link.summary || '');
        else {
          // Evita apresentar o resumo de uma lista inteira como descrição de um único projeto.
          const generic = /^(skills|awesome|ai|agents|tools|app|repo|examples|docs|api|data|marketing)$/.test(name);
          summary = String(link.summary || '').split(/\n+|(?<=[.!?])\s+/).filter(sentence => {
            const lower = sentence.toLowerCase();
            return lower.includes(repo.key) || !generic && lower.split(/[^a-z0-9_.-]+/).includes(name);
          }).slice(0, 2).join(' ');
        }
        const score = (own ? 4 : 0) + (summary ? 2 : 0) + (!link.summary_inferred ? 1 : 0);
        let saved = repos.get(repo.key);
        if (!saved){ saved = { ...repo, sources: [], score: -1 }; repos.set(repo.key, saved); }
        if (!saved.sources.includes(link.id)) saved.sources.push(link.id);
        if (score > saved.score) Object.assign(saved, { categoryId: link.category_id || '__uncategorized', summary, inferred: !!link.summary_inferred, sourceId: link.id, score });
      }
    }
    return [...repos.values()].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }
  const api = { parse, collect };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GithubLibrary = api;
})(typeof window !== 'undefined' ? window : globalThis);
