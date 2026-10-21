const test = require('node:test');
const assert = require('node:assert/strict');
const handler = require('../api/github.js');
function response(){ return { headers: {}, setHeader(k,v){ this.headers[k]=v; }, status(s){ this.code=s; return this; }, json(data){ this.data=data; return this; } }; }
test('only accepts a public repository name and GET, without fetching invalid input', async () => {
  for (const repo of ['https://evil.test', '../secret', ['a/b'], 'a/b/tree/main', 'topics/ai']) {
    const res=response(); await handler({method:'GET',query:{repo}},res); assert.equal(res.code,400);
  }
  const res=response();await handler({method:'POST',query:{repo:'a/b'}},res);assert.equal(res.code,405);
});
test('returns only public description, caches success and tolerates GitHub failure', async () => {
  const original=global.fetch;
  try {
    global.fetch=async url=>{ assert.equal(url,'https://api.github.com/repos/team/repo');return {ok:true,json:async()=>({description:'Organiza PDFs.',private:false,token:'must not escape'})}; };
    const res=response();await handler({method:'GET',query:{repo:'team/repo'}},res);
    assert.equal(res.code,200);assert.deepEqual(res.data,{description:'Organiza PDFs.'});assert.match(res.headers['Cache-Control'],/s-maxage=86400/);
    global.fetch=async()=>({ok:false,status:403});
    const failure=response();await handler({method:'GET',query:{repo:'team/repo'}},failure);
    assert.equal(failure.data.unavailable,true);assert.equal(failure.data.description,null);
  } finally { global.fetch=original; }
});
