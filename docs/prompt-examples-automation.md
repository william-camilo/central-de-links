# Exemplos visuais e automação de novos links

## Estado atual — 20/10/2026

A ficha `f6c7f0d2-e3bf-4b90-825f-d27213ecc59e` tem três comparações reais geradas com a mesma pessoa fictícia: capa de revista, iluminação azul e miniatura de YouTube. Os comandos curtos foram extraídos da fonte; as instruções completas usadas na geração são adaptações identificadas e copiáveis. Os arquivos WebP ficam em `assets/prompt-examples/`, e os metadados e prompts estão em `pilot-guides.js`. Os exemplos foram produzidos pela ferramenta de geração de imagens do ChatGPT, não por uma integração do site.

O recebimento via Telegram e a análise existente continuam funcionando. **A criação de novos exemplos ainda não é automática.** Esta seção descreve a próxima implementação; não há novos gatilhos, filas, chamadas pagas ou alterações no banco implantados por esta mudança.

## Fluxo proposto

1. O `telegram-webhook` recebe o link pelo fluxo existente. O `video-worker` continua o processamento do vídeo e a extração de fala/textos da tela.
2. Depois da análise, um trabalho extrai uma lista estruturada de prompts, com trecho de origem, objetivo, ferramenta citada, tipo de saída e indicação de completude. O conteúdo recebido é dado, nunca instrução para executar código, abrir URLs arbitrárias ou obter segredos.
3. Para cada prompt visual suficiente, cria-se um registro na fila. Um comando curto sem sua definição, ou um vídeo que pede comentário/curso para revelar o prompt, recebe `needs_review`; uma adaptação só pode aparecer com a origem `suggested`, separada de `extracted`.
4. A fila escolhe uma imagem-base conforme o objetivo: pessoa fictícia para retratos, produto fictício para fotografia comercial, ambiente para decoração. Um prompt de texto, código ou vídeo não deve receber uma foto de pessoa como exemplo artificialmente.
5. Um worker chama a API de geração/edição de imagens com a imagem-base e o prompt aprovado. Grava resultado, provedor, modelo, prompt exato, data, erro resumido e uso informado pela API. Se for uma ferramenta diferente da citada no vídeo, o site identifica a demonstração como adaptação nessa ferramenta.
6. O resultado vai para Storage; o banco relaciona foto-base, resultado e prompt ao link. A ficha consulta esses registros e mostra antes/depois, botões de cópia e download e o estado atual.

## Acionamento e persistência

- Acionar somente quando o conteúdo analisado estiver disponível; a simples chegada do link não garante que o Instagram permitiu ler o vídeo. Um webhook de banco pode reagir à mudança para `video_status = done`. Um consumidor periódico de fila também deve recuperar trabalhos pendentes se uma chamada falhar.
- Usar uma chave única por link + hash do prompt normalizado + hash da imagem-base + provedor/modelo + versão da receita. Atualizar a ficha ou receber novamente o mesmo link não pode gerar cobrança repetida.
- Estados previstos: `queued`, `generating`, `ready`, `needs_review`, `blocked_budget`, `failed`. Uma ficha só mostra “exemplo disponível” após a imagem estar salva e vinculada.
- Reservar atomicamente o limite antes da chamada paga. Timeout com resposta incerta deve ir para revisão, sem repetir automaticamente uma cobrança que possa já ter ocorrido.
- Guardar a fila em esquema privado. Publicar apenas os resultados associados a links que já podem ser lidos, com RLS e privilégios explícitos. Chaves ficam exclusivamente no servidor.

## Configuração necessária para ativação

- Provedor e modelo de imagem disponíveis na conta. O uso atual de modelos Gemini de texto não comprova habilitação, cota ou faturamento para imagens. A ferramenta de imagens desta conversa também não é uma API acionável pelo site.
- Credencial configurada por canal seguro e validada com uma única geração controlada.
- Limite por link, limite diário e teto monetário acordados antes de ativar o modo automático. Proposta inicial para avaliação: até 3 exemplos por link, consumo sequencial, sem reprocessamento do acervo antigo. O limite diário e o teto em dinheiro ainda não foram definidos.
- Antes de liberar: testar prompt completo, comando incompleto, link repetido, vídeo indisponível, erro do provedor, saldo/limite esgotado e vínculo correto das imagens na ficha.

## Documentação oficial consultada

- [Supabase Database Webhooks](https://supabase.com/docs/guides/database/webhooks)
- [Supabase Background Tasks](https://supabase.com/docs/guides/functions/background-tasks) — tarefas em segundo plano continuam sujeitas aos limites de execução; usar fila persistente.
- [Gemini: geração e edição de imagens](https://ai.google.dev/gemini-api/docs/image-generation)
- [Gemini: preços](https://ai.google.dev/gemini-api/docs/pricing) e [faturamento](https://ai.google.dev/gemini-api/docs/billing) — consultar o modelo escolhido antes de configurar o orçamento.
