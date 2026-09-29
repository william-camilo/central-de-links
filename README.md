# Central de Links

App de leitura ao vivo dos links organizados pelo bot do Telegram [@WillexLinkBot](https://t.me/WillexLinkBot). Lê direto do Supabase — sem build, sem back-end próprio: é um único `index.html` estático.

## Telas

- **Início** — busca, contagem por tema, lista de recentes.
- **Tema** — todos os links de uma categoria, com resumo gerado por IA, legenda original (quando o Instagram permite raspar) e links citados dentro do post.
- **Relatório** — visão para leitura/impressão manual, completa ou por tema (`#/relatorio/<categoria>`).

## Como funciona

- **Ingestão**: os links chegam via Telegram (bot + Supabase Edge Function), são categorizados e resumidos por IA (Gemini) e gravados no Postgres do Supabase.
- **Leitura**: este site usa a chave `anon` pública do Supabase (client-side, sem segredo real por trás — é assim que o Supabase JS funciona por design) para ler apenas o que está liberado por Row Level Security:
  - `categories` — leitura pública total.
  - `links` — leitura pública **somente** onde `status = 'processed'` (links em processamento ou com erro nunca aparecem aqui).
  - `cited_links` — leitura pública condicionada ao link-pai estar processado.
  - `app_secrets` e `telegram_events` seguem travados, só para `service_role`.

A chave `anon` embutida no `index.html` **não é um segredo** — ela só abre o que essas políticas de RLS permitem. Trocar essa chave de lugar (variável de ambiente, etc.) não muda o nível de segurança real; o que protege os dados são as políticas no banco.

## Deploy

Site estático puro — sem etapa de build. Qualquer host de estáticos serve (Vercel, Netlify, GitHub Pages). No Vercel: importar este repositório, sem configurar nada (framework: "Other" / sem build command), deploy direto.

## Limitação conhecida

Não existe geração de PDF a partir do próprio site (é só uma visão de leitura). Um PDF de verdade, como arquivo baixável, é gerado fora deste projeto.
