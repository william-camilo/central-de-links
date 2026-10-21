const { parse } = require('../github-library.js');

module.exports = async function(req, res){
  if (req.method !== 'GET') { res.setHeader('Allow','GET'); return res.status(405).json({error:'Método não permitido.'}); }
  const name = req.query.repo;
  const repo = typeof name === 'string' && parse('https://github.com/' + name);
  if (!repo || repo.name !== name) return res.status(400).json({error:'Repositório inválido.'});
  try {
    // shortcut: consulta pública com cota por IP; usar credencial de servidor se o cache diário deixar de bastar.
    const upstream = await fetch('https://api.github.com/repos/' + repo.name, {
      headers: {'Accept':'application/vnd.github+json','User-Agent':'Central-de-Links'},
      signal: AbortSignal.timeout(7000),
    });
    if (!upstream.ok) throw new Error('GitHub indisponível');
    const data = await upstream.json();
    if (data.private) throw new Error('Repositório privado');
    res.setHeader('Cache-Control','public, max-age=300, s-maxage=86400, stale-while-revalidate=86400');
    return res.status(200).json({description: typeof data.description === 'string' ? data.description.slice(0,2000) : null});
  } catch {
    res.setHeader('Cache-Control','public, max-age=30, s-maxage=60');
    return res.status(200).json({description:null, unavailable:true});
  }
};
