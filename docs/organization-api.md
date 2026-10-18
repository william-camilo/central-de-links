# Contrato de sincronização da organização

Integração implementada em `supabase/functions/manage-admin/organization.ts`, publicada e verificada no Supabase em 18/10/2026. Reutiliza a autenticação por PIN e os limites de tentativas de `manage-admin`. Pastas, tags e favoritos não têm leitura pública.

## Leitura

`POST /functions/v1/manage-admin`, com o cabeçalho `x-pin` existente:

```json
{"action":"organization_get"}
```

Resposta:

```json
{
  "data": {"version": 1, "folders": [], "links": {}},
  "revision": 0
}
```

Cada pasta tem `id` e `name`. Cada entrada em `links` é indexada pelo ID do link existente e contém `favorite` (booleano), `folder` (ID da pasta ou string vazia) e `tags` (lista de strings).

## Gravação

```json
{
  "action": "organization_save",
  "expected_revision": 0,
  "data": {"version": 1, "folders": [], "links": {}}
}
```

A gravação deve comparar e incrementar a revisão atomicamente. Se outro dispositivo já alterou a revisão, responder HTTP 409 sem sobrescrever os dados. Em caso de sucesso, devolver `data` e a nova `revision` no mesmo formato da leitura.

## Validação e proteção

- Autorizar as duas ações usando a mesma validação do PIN e o mesmo bloqueio de tentativas das operações existentes.
- Validar o JSON no servidor. A validação do frontend não é uma barreira de segurança.
- Aceitar apenas versão 1, até 200 pastas e até 20.000 entradas de organização. Limitar o tamanho total da requisição.
- Validar IDs, nomes de pastas com até 60 caracteres e até 12 tags por link, cada uma com até 40 caracteres.
- Validar que os links referenciados existem e que as pastas referenciadas pertencem à organização. Metadados de links removidos ou não processados são descartados no salvamento, evitando que uma exclusão em outro dispositivo bloqueie a organização.
- Proteger a tabela com RLS e negar acesso direto a `anon` e `authenticated`. A Edge Function autorizada deve controlar a leitura e a gravação.
- Remover uma pasta apenas desfaz a associação. Não excluir links, categorias ou conteúdo.
- Preservar autenticação, respostas de erro, cotas e comportamento das ações atuais de `manage-admin`.

## Comportamento do cliente

A biblioteca de conteúdo continua com a leitura pública existente. Pastas, favoritos e tags são desbloqueados por PIN. O PIN permanece somente na sessão do navegador, conforme o fluxo original. A organização não é salva em `localStorage`.

Em um conflito, o cliente recarrega a versão remota e solicita que a alteração seja repetida. O teste de contrato usa dois contextos de navegador. Para buscar alterações feitas em outro dispositivo, use "Atualizar" ou reabra o site; não há assinatura em tempo real.

## Validação em 18/10/2026

- Cinco testes do backend passaram: normalização, referências inválidas, limite de corpo, conflito entre dispositivos e propagação de falha do banco.
- Testes de navegador passaram em larguras de 320 a 1440 px, incluindo leitura, busca, filtros, PDF, organização e recuperação de erro.
- A Edge Function real respondeu 200 à leitura e ao salvamento autenticados. O salvamento manteve o conteúdo existente e incrementou apenas a revisão.
- Uma gravação com revisão antiga retornou 409, sem sobrescrever o conteúdo.
- Uma leitura sem PIN retornou 401. O teste autenticado seguinte confirmou que o fluxo anterior continua ativo.
- RLS está habilitado. `anon` e `authenticated` não têm leitura direta da tabela; `anon` não tem escrita.
- O PIN foi usado internamente no projeto, sem exportar seu valor, trocar a credencial ou expô-la em logs do cliente.

O verificador do Supabase informa ausência de políticas nas tabelas privadas; isso é intencional, pois somente `service_role` deve acessá-las. Também existe um aviso anterior de `search_path` em `api_key_touch`, fora desta alteração: [orientação do Supabase](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable).
