const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
for(const m of html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g))if(m[1].trim())new vm.Script(m[1]);
const ctx=vm.createContext({window:{},personal:{folders:[]},state:{links:[]},searchQuery:'',catById:()=>({name:'Tecnologia e IA'}),esc:s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),safeUrl:u=>/^https?:/.test(u)?u:'#'});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../pilot-guides.js'),'utf8'),ctx);
const start=html.indexOf('function normalizeSearch('),end=html.indexOf('function personalOptions(');
vm.runInContext(html.slice(start,end),ctx);
const check=(code)=>vm.runInContext(code,ctx);
assert.equal(check("matchesQuery(normalizeSearch('FOTOGRAFIA DE PERFUME'),searchTerms('fotografar perfume'))"),true);
assert.equal(check("matchesQuery(normalizeSearch('animação de imagens'),searchTerms('animar uma foto'))"),true);
assert.equal(check("matchesQuery(normalizeSearch('AÇÃO com IA'),searchTerms('acao'))"),true);
assert.equal(check("matchesQuery(normalizeSearch('um canal sem rosto'),searchTerms('canal sem aparecer'))"),true);
const all={title:'Título',summary:'Resumo',caption:'Legenda',transcript:'PalavraSóNaFala',raw_url:'https://example.com',screen_text:['TextoSóNaTela'],tools_cited:['FerramentaSóAqui'],cited_links:[{label:'ReferenciaUnica',url:'https://ref.example'}]};
ctx.link=all;
for(const q of ['palavrasonafala','TEXTOSONATELA','ferramentasoaqui','referenciaunica','EXAMPLE.COM']){
 ctx.query=q;assert.equal(check('matchesQuery(searchableText(link,{tags:[]},null),searchTerms(query))'),true);
}
assert.equal(check('Object.keys(window.CENTRAL_GUIDES).length'),10);
assert.equal(check('TOPICS.length'),6);
const visuals=ctx.window.CENTRAL_GUIDES['f6c7f0d2-e3bf-4b90-825f-d27213ecc59e'].visualExamples;
assert.equal(visuals.examples.length,3);
for(const file of [visuals.base,...visuals.examples.map(e=>e.image)]){
 assert.ok(fs.statSync(require('node:path').join(__dirname,'..',file)).size>1000);
 assert.notEqual(check('exampleImageUrl('+JSON.stringify(file)+')'),'#');
}
assert.equal(check("exampleImageUrl('javascript:alert(1)')"),'#');
for(const example of visuals.examples){
 ctx.exampleCommand=example.command;
 const rendered=check("promptExample(window.CENTRAL_GUIDES['f6c7f0d2-e3bf-4b90-825f-d27213ecc59e'].visualExamples,exampleCommand)");
 assert.equal((rendered.match(/<img /g)||[]).length,2);
 assert.ok(rendered.includes('Copiar prompt do exemplo')&&rendered.includes('Antes')&&rendered.includes('Depois'));
 assert.ok(example.prompt.length>100);
}
for(const g of Object.values(ctx.window.CENTRAL_GUIDES)){assert.ok(g.steps.length&&g.example&&g.prompt&&g.goal&&g.tools.length);assert.ok(g.topics.every(t=>['prompts','imagens','videos','agentes','automacao','sites'].includes(t)));}
assert.equal(check("matchesAnalysis({video_status:'downloading'},'pending')"),true);
assert.equal(check("matchesAnalysis({video_status:'no_video'},'unavailable')"),true);
assert.equal(check("matchesAnalysis({needs_review:true},'review')"),true);
assert.equal(check("matchesAnalysis({video_status:'done'},'pending')"),false);
ctx.searchQuery='script';ctx.link.transcript='<script>alert(1)</script>';
assert.ok(check('searchSnippet(link)').includes('&lt;script&gt;'));
assert.ok(!check('searchSnippet(link)').includes('<script>'));
// Favorite updates from the guides page must not access the library-only grid.
let guideRenders=0;
const updateContext=vm.createContext({topicView:true,renderGuides:()=>guideRenders++});
vm.runInContext(html.slice(html.indexOf('function updateResults('),html.indexOf('function recentCard(')),updateContext);
vm.runInContext('updateResults()',updateContext);
assert.equal(guideRenders,1);

// Search must cover all pages and must surface a failed page instead of partial results.
(async()=>{
 const calls=[],dataset=Array.from({length:1001},(_,id)=>({id}));
 const query={select(){return this;},eq(){return this;},order(){return this;},range(start,end){calls.push([start,end]);return Promise.resolve({data:dataset.slice(start,end+1)});}};
 const paging=vm.createContext({sb:{from:()=>query}});
 vm.runInContext(html.slice(html.indexOf('function loadLinksPage('),html.indexOf('function loadData(')),paging);
 const result=await vm.runInContext('loadLinksPage(0,[])',paging);
 assert.equal(result.data.length,1001);
 assert.deepEqual(calls,[[0,499],[500,999],[1000,1499]]);
 const failure=new Error('Page unavailable');
 query.range=()=>Promise.resolve({error:failure});
 await assert.rejects(vm.runInContext('loadLinksPage(0,[])',paging),error=>error===failure);
 console.log('PASS: syntax, case/accent-insensitive search, objective aliases, transcript/screen/reference coverage, six topics, ten guides, processing filters, escaped snippets, guide refresh and complete paginated loading.');
})().catch(error=>{console.error(error);process.exitCode=1;});
