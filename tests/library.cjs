// Run with Playwright available in NODE_PATH, or install it locally with npm install --no-save playwright@1.62.1.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const categories = [{id:'cat-1',name:'Tecnologia e IA',color:'#8ac9ff'}, {id:'cat-2',name:'Estilo de Vida',color:'#70e0c0'}];
const links = Array.from({length:17}, (_,i)=>({
  id:'link-'+i,category_id:i%2?'cat-2':'cat-1',raw_url:'https://example.com/'+i,
  title:i===0?'Automóveis e organização':`Referência ${String(i).padStart(2,'0')}`,
  summary:'Um resumo completo para validar a leitura e as referências.',caption:'Legenda original.',
  media_type:i%3?'article':'video',processed_at:'2026-10-17T12:00:00Z',
  needs_review:i===1,summary_inferred:i===1,video_status:i===0?'done':null,
  tools_cited:[],screen_text:[],link_images:[],cited_links:[{id:'citation-'+i,url:'https://example.com/reference',label:'Referência externa'}]
}));
let saved = {version:1,folders:[],links:{}};
let revision = 0, conflictNext = false, failRest = false, writes = 0;

const server = http.createServer((request,response)=>{
  const name = new URL(request.url,'http://localhost').pathname;
  if(!['/','/index.html','/layout.css','/pilot-guides.js','/github-library.js'].includes(name)){response.writeHead(404);response.end();return;}
  response.setHeader('Content-Type',name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html; charset=utf-8');
  response.end(fs.readFileSync(path.join(root,name==='/'?'index.html':name.slice(1))));
});

(async()=>{
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});
  const errors=[];
  async function device(unlocked=true){
    const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
    if(unlocked)await context.addInitScript(()=>sessionStorage.setItem('cdl_pin','test-only-pin'));
    await context.route('**/rest/v1/**',route=>{
      const url=new URL(route.request().url());
      if(failRest)return route.fulfill({status:400,json:{message:'Teste de indisponibilidade'}});
      if(url.pathname.endsWith('/categories'))return route.fulfill({json:categories});
      if(url.searchParams.get('select')==='transcript')return route.fulfill({json:{transcript:'Transcrição carregada sob demanda.'}});
      return route.fulfill({json:links});
    });
    await context.route('**/functions/v1/**',route=>{
      const request=route.request(),body=request.postDataJSON();
      assert.equal(request.headers()['x-pin'],'test-only-pin');
      if(body.action==='organization_get')return route.fulfill({json:{data:saved,revision}});
      if(body.action==='organization_save'){
        if(conflictNext||body.expected_revision!==revision){conflictNext=false;return route.fulfill({status:409,json:{error:'A organização foi alterada em outro dispositivo.'}});}
        saved=body.data;revision++;writes++;return route.fulfill({json:{data:saved,revision}});
      }
      if(body.action==='review_move'){
        const item=links.find(link=>link.id===body.id);item.category_id=body.category_id;item.needs_review=false;
        return route.fulfill({json:{ok:true}});
      }
      throw new Error('Unexpected mutation in test: '+body.action);
    });
    const page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));
    await page.goto(base);await page.locator('.library-card').first().waitFor();
    return {page,context};
  }
  try{
    const guest=await device(false);
    await guest.page.locator('.sidebar [href="#/pastas"]').click();
    assert.equal(await guest.page.locator('.theme-folder').count(),2);
    assert.equal(await guest.page.locator('.theme-link-count').evaluateAll(nodes=>nodes.reduce((sum,node)=>sum+Number(node.textContent),0)),17);
    await guest.page.locator('.theme-folder[data-theme-id="cat-1"]').click();
    await guest.page.locator('#tema:not(.hidden)').waitFor();
    assert.equal(await guest.page.locator('#tema .item-card').count(),9);
    links.push({...links[0],id:'orphan-link',category_id:null,title:'Conteúdo sem categoria'});
    await guest.page.goto(base+'/#/pastas');await guest.page.reload();
    await guest.page.locator('[data-theme-id="__uncategorized"]').click();
    await guest.page.locator('#tema:not(.hidden)').waitFor();
    assert.equal(await guest.page.locator('#tema .item-card').count(),1);
    assert.equal(await guest.page.locator('#btn-del-tema').count(),0);
    await guest.page.goto(base+'/#/relatorio/__uncategorized');
    await guest.page.locator('.paper-item').waitFor();
    assert.equal(await guest.page.locator('.paper-item').count(),1);
    links.pop();await guest.context.close();
    const first=await device(),page=first.page;
    assert.equal(await page.locator('.library-card').count(),12);
    await page.locator('#show-more').click();assert.equal(await page.locator('.library-card').count(),17);
    for(const width of [1440,1024,768,390,320]){
      await page.setViewportSize({width,height:950});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Horizontal overflow at ${width}px`);
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('#search-input').fill('automoveis');assert.equal(await page.locator('.library-card').count(),1);
    assert.equal(await page.locator('#search-input').evaluate(el=>document.activeElement===el),true);
    await page.locator('#search-input').fill('');
    await page.locator('[data-filter-type=video]').click();assert.equal(await page.locator('.library-card').count(),6);
    await page.locator('[data-filter-type=all]').click();
    await page.locator('[data-favorite="link-0"]').click();
    await page.waitForFunction(()=>document.querySelector('[data-favorite="link-0"]').getAttribute('aria-pressed')==='true');
    await page.locator('.sidebar [href="#/favoritos"]').click();assert.equal(await page.locator('.library-card').count(),1);
    await page.locator('.sidebar [href="#/pastas"]').click();
    await page.locator('#home [data-new-folder]').first().click();
    await page.locator('#folder-name').fill('Projeto pessoal');await page.locator('#folder-form [type=submit]').click();
    await page.locator('#library-dialog').waitFor({state:'hidden'});
    const folder=saved.folders[0];assert.equal(folder.name,'Projeto pessoal');
    await page.goto(base+'/#/link/link-0');await page.locator('#link-folder').waitFor();
    await page.locator('#link-folder').selectOption(folder.id);await page.locator('#link-tags').fill('referência, automóveis');
    await page.locator('#link-category').selectOption('cat-2');
    await page.locator('#organization-form [type=submit]').click();
    await page.waitForFunction(()=>document.querySelector('#global-message').textContent==='Organização salva.');
    assert.equal(saved.links['link-0'].folder,folder.id);assert.deepEqual(saved.links['link-0'].tags,['referência','automóveis']);
    assert.equal(links[0].category_id,'cat-2');
    await page.locator('details[data-transcript-id] summary').click();
    await page.getByText('Transcrição carregada sob demanda.',{exact:true}).waitFor();
    const download=page.waitForEvent('download');await page.locator('#single-pdf').click();
    const pdf=await download;assert.match(pdf.suggestedFilename(),/\.pdf$/);assert.equal(await pdf.failure(),null);
    const second=await device();
    await second.page.locator('.sidebar [href="#/favoritos"]').click();
    assert.equal(await second.page.locator('.library-card').count(),1);
    await second.page.goto(base+'/#/link/link-0');
    await second.page.locator('#link-tags').waitFor();assert.equal(await second.page.locator('#link-tags').inputValue(),'referência, automóveis');
    await page.goto(base);await page.locator('.library-card').first().waitFor();
    conflictNext=true;const beforeWrites=writes;
    await page.locator('[data-favorite="link-1"]').click();
    await page.getByText(/organização mudou em outro dispositivo/).waitFor();
    assert.equal(writes,beforeWrites);assert.equal(saved.links['link-1'],undefined);
    await page.goto(base+'/#/pastas');await page.locator('[data-remove-folder]').waitFor();
    page.once('dialog',dialog=>dialog.accept());await page.locator('[data-remove-folder]').click();
    await page.getByText('Pasta removida. Seus links foram preservados.',{exact:true}).waitFor();
    assert.equal(saved.folders.length,0);assert.equal(saved.links['link-0'].folder,'');assert.equal(links.length,17);
    await page.goto(base+'/#/config');assert.equal(await page.locator('#btn-delete-all').isVisible(),false);
    assert.equal(await page.locator('#btn-keys-open').isVisible(),true);
    failRest=true;await page.goto(base);await page.locator('[data-retry]').waitFor();failRest=false;
    await page.locator('[data-retry]').click();await page.locator('.library-card').first().waitFor();
    links.push({...links[0],id:'github-direct',raw_url:'https://github.com/team/alpha.git',normalized_url:'github.com/team/alpha',title:'Alpha',summary:'Automação de tarefas e agentes locais.',category_id:'cat-1',cited_links:[]});
    links.push({...links[0],id:'github-list',raw_url:'https://example.com/projects',normalized_url:'example.com/projects',summary:'Vários projetos úteis.',category_id:'cat-2',cited_links:[{url:'https://github.com/TEAM/alpha/tree/main'},{url:'https://github.com/team/beta'},{url:'https://github.com/team'}]});
    await page.route('**/api/github?*',route=>route.fulfill({json:{description:'Organiza documentos PDF.'}}));
    await page.goto(base+'/#/github');await page.reload();
    await page.locator('.repo-card').first().waitFor();assert.equal(await page.locator('.repo-card').count(),2);
    await page.getByText('Organiza documentos PDF.',{exact:true}).waitFor();
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedRepo=text;}}}));
    await page.locator('[data-repo-key="team/alpha"] [data-copy-repo]').click();
    await page.waitForFunction(()=>window.copiedRepo==='https://github.com/team/alpha.git');
    await page.locator('.github-categories [href="#/github/cat-1"]').click();
    assert.equal(await page.locator('.repo-card').count(),1);
    await page.locator('#github-search').fill('não existe');assert.equal(await page.locator('.repo-card').count(),0);
    await page.locator('#github-search').fill('automacao');assert.equal(await page.locator('.repo-card').count(),1);
    await page.evaluate(()=>Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw new Error('denied');}}}));
    await page.locator('[data-copy-repo]').click();await page.getByText(/Selecionei a URL/).waitFor();
    assert.equal(await page.locator('.repo-clone input').evaluate(input=>input.selectionEnd-input.selectionStart), 'https://github.com/team/alpha.git'.length);
    for(const width of [1440,768,390,320]){await page.setViewportSize({width,height:950});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    links.push({...links[0],id:'github-new',raw_url:'https://github.com/fresh/project',normalized_url:'github.com/fresh/project',cited_links:[]});
    await page.goto(base+'/#/github');await page.locator('[data-refresh-library]').click();
    await page.waitForFunction(()=>document.querySelectorAll('.repo-card').length===3);
    await page.locator('[data-repo-key="team/alpha"] .repo-actions a').click();await page.locator('#organization-form').waitFor();
    assert.deepEqual(errors,[]);
    console.log('PASS: public thematic folders, category coverage, orphan-link access and report, responsive layout, search, filters, pagination, favorites, personal folders, classification, transcripts, PDF, two-device sync contract, conflict protection, safe folder removal, PIN settings and retry.');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
