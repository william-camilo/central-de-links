# Central de Links

App de leitura ao vivo dos links organizados pelo bot do Telegram [@WillexLinkBot](https://t.me/WillexLinkBot). O frontend é estático: `index.html` contém a aplicação e `layout.css` define o layout responsivo inspirado no Fast Summ. O build apenas copia esses dois arquivos para `dist/`, sem dependências. As operações protegidas usam Edge Functions no Supabase.

## Telas

- **Biblioteca** — busca sem distinção de acentos, filtros por categoria e formato, ordenação e carregamento progressivo dos cards.
- **Pastas por tema** — categorias existentes apresentadas como pastas, com contagem real e acesso sem PIN. Cada link usa sua associação atual no banco, sem duplicar registros. Links com categoria ausente aparecem em "Sem categoria", inclusive no relatório.
- **Pastas e favoritos** — organização pessoal protegida pelo PIN, com sincronização entre dispositivos pelo contrato descrito em `docs/organization-api.md`.
- **Leitura** — acesso direto a um link, resumo, referências, imagens, transcrição, PDF e edição da organização.
- **Tema** — todos os links de uma categoria, com resumo gerado por IA, legenda original (quando o Instagram permite raspar) e links citados dentro do post.
- **Relatório** — visão para leitura/impressão manual, completa ou por tema (`#/relatorio/<categoria>`).
- **Revisão** — confirmar a sugestão da IA, manter a categoria ou mover o conteúdo.
- **Configurações** — gerenciamento de chaves e zona de risco recolhida, mantendo confirmação e PIN nas exclusões.

## Organização sincronizada

`manage-admin` implementa `organization_get` e `organization_save`, protegidas pelo PIN existente. A tabela `library_organization` tem RLS e não permite acesso direto aos papéis públicos. Revisões impedem que um dispositivo sobrescreva alterações recentes de outro. Não há fallback em `localStorage`. Use "Atualizar" ou reabra o site para buscar alterações feitas em outro dispositivo.

Fontes e migração estão em `supabase/`. O contrato e a validação realizada estão em `docs/organization-api.md`. A revisão dos temas está em `docs/classification-review.md`.

## Como funciona

- **Ingestão**: os links chegam via Telegram (bot + Supabase Edge Function), são categorizados e resumidos por IA (Gemini) e gravados no Postgres do Supabase.
- **Leitura**: este site usa a chave `anon` pública do Supabase (client-side, sem segredo real por trás — é assim que o Supabase JS funciona por design) para ler apenas o que está liberado por Row Level Security:
  - `categories` — leitura pública total.
  - `links` — leitura pública **somente** onde `status = 'processed'` (links em processamento ou com erro nunca aparecem aqui).
  - `cited_links` — leitura pública condicionada ao link-pai estar processado.
  - `app_secrets` e `telegram_events` seguem travados, só para `service_role`.

A chave `anon` embutida no `index.html` **não é um segredo** — ela só abre o que essas políticas de RLS permitem. Trocar essa chave de lugar (variável de ambiente, etc.) não muda o nível de segurança real; o que protege os dados são as políticas no banco.

## Deploy

No Vercel, `vercel.json` configura "Other", executa `node build.cjs` e publica somente `dist/`. As fontes de Edge Functions, testes e documentação não são servidas pelo site. Para outro host estático, execute o mesmo comando e publique essa pasta.

## Validação

O PDF é gerado no navegador com jsPDF, por link, categoria, biblioteca ou seleção filtrada.

O teste `tests/library.cjs` inicia um servidor temporário, intercepta as APIs e não escreve no banco real. Cobre busca, filtros, telas pequenas, favoritos, pastas, classificação, transcrição, download de PDF, o contrato de sincronização entre dois navegadores, conflito de revisão e recuperação de falhas.

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node tests/library.cjs
```

Para usar um Edge já instalado, configure `PLAYWRIGHT_CHANNEL=msedge`. Também é possível usar uma instalação existente do Playwright via `NODE_PATH`.

O backend tem testes de validação e conflito: `node --test tests/organization.mjs` (Node 24). A validação real no Supabase confirmou leitura e gravação com PIN, conflito HTTP 409 e recusa HTTP 401 sem PIN.
