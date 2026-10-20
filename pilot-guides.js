// Fichas editoriais: exemplos sugeridos separados de trechos extraídos.
window.CENTRAL_GUIDES = {
  "f6c7f0d2-e3bf-4b90-825f-d27213ecc59e": {
    "topics": [
      "prompts",
      "imagens"
    ],
    "goal": "Explorar capas de revista, iluminação de retratos e miniaturas de vídeo.",
    "tools": [
      "ChatGPT"
    ],
    "complete": true,
    "steps": [
      "Escolha o tipo de imagem que deseja produzir com sua foto.",
      "O autor cita /magazine-cover para capa de revista e /youtube-thumbnail para miniatura.",
      "Para mudar o fundo, o autor menciona /relight acompanhado do nome de uma cor em inglês."
    ],
    "gap": "O vídeo não mostra uma instrução detalhada que preserve todos os elementos da foto nem esclarece se usa alguma configuração personalizada.",
    "extracted": [
      "/magazine-cover",
      "/relight",
      "/youtube-thumbnail"
    ],
    "example": "Preparar uma capa de apresentação de produtos com uma foto sua. Abaixo está uma instrução sugerida em linguagem natural.",
    "prompt": "Use a foto anexada como referência para uma capa de revista profissional. Preserve minha identidade e características. Título: [título]. Paleta: [cores]. Formato: [proporção]. Antes de gerar, confirme quais textos devem aparecer."
  },
  "2aa4809b-7eab-45e2-b4c7-b9240d67c6bb": {
    "topics": [
      "agentes",
      "prompts"
    ],
    "goal": "Preparar as instruções de um assistente com seu estilo profissional.",
    "tools": [
      "Google Gemini",
      "Gems"
    ],
    "complete": true,
    "steps": [
      "Abra o Gemini e peça uma descrição do seu tom de voz e histórico profissional com base no contexto que ele tem.",
      "Peça para organizar essas características em um prompt em Markdown.",
      "Copie as instruções, abra Gems, crie um novo Gem e preencha nome, descrição e instruções.",
      "Inicie uma conversa com o assistente criado."
    ],
    "gap": "O prompt completo do autor não foi capturado. O histórico acessível à ferramenta pode ser limitado.",
    "extracted": [],
    "example": "Um assistente para preparar propostas comerciais no seu tom, com informações que você fornecer.",
    "prompt": "Ajude a criar as instruções de um assistente de apoio comercial. Use apenas o perfil profissional e exemplos de escrita que eu fornecer. Primeiro peça as informações que faltam. Depois entregue em Markdown: objetivo, tom, tarefas permitidas, limites e exemplos de resposta. Não invente preços, prazos ou características de produtos."
  },
  "f1a8db61-a536-4351-ae57-3db365b3aa0c": {
    "topics": [
      "sites"
    ],
    "goal": "Revisar como uma página se comporta em diferentes tamanhos de tela.",
    "tools": [
      "Mobile View"
    ],
    "complete": false,
    "steps": [
      "O autor apresenta a extensão Mobile View como ferramenta de visualização em vários aparelhos.",
      "Use o conteúdo como referência para planejar a revisão de uma página."
    ],
    "gap": "Não há link de instalação confirmado, configuração detalhada nem checklist completo na transcrição.",
    "extracted": [],
    "example": "Revisar a página de um catálogo no celular, tablet e computador. O checklist abaixo é uma sugestão adicional.",
    "prompt": "Crie um checklist de responsividade para uma página de catálogo. Inclua leitura dos textos, menus, imagens, botões, formulários e rolagem horizontal. Organize os testes para telas de 320, 390, 768 e 1440 pixels. Não afirme que os testes já foram executados."
  },
  "81edaafb-f8ed-4835-bb76-2bf828c5a6c9": {
    "topics": [
      "agentes",
      "automacao"
    ],
    "goal": "Mapear melhorias de memória, contexto e organização no trabalho com Claude Code.",
    "tools": [
      "Claude Code",
      "OmniRoute",
      "Claude-mem",
      "Headroom",
      "Claude Code Setup",
      "Task Observer"
    ],
    "complete": false,
    "steps": [
      "Identifique a necessidade: memória entre sessões, redução de contexto, configuração ou acompanhamento de tarefas.",
      "O vídeo apresenta cinco ferramentas, cada uma ligada a uma dessas necessidades.",
      "Use a lista para iniciar a avaliação de compatibilidade e documentação."
    ],
    "gap": "A fonte não fornece comandos de instalação completos. Gratuidade, limites e compatibilidade mencionados pelo autor não foram verificados.",
    "extracted": [],
    "example": "Avaliar uma ferramenta por vez em um projeto de teste, registrando o problema que ela pretende resolver.",
    "prompt": "Ajude a avaliar [ferramenta] para meu projeto [descrição]. Consulte a documentação oficial atual e identifique função, requisitos, permissões, custos e limitações. Proponha um teste pequeno e reversível. Não instale nada nesta etapa."
  },
  "79471a42-18c0-4c73-8d6f-b98e2caada56": {
    "topics": [
      "sites",
      "agentes"
    ],
    "goal": "Usar exemplos de gráficos como referência para uma interface.",
    "tools": [
      "vgpu",
      "WebGPU",
      "TypeScript"
    ],
    "complete": false,
    "steps": [
      "A fonte apresenta a biblioteca vgpu e seu catálogo de exemplos.",
      "Escolha um efeito que combine com o objetivo da sua página.",
      "O autor menciona acesso a exemplos via CLI ou MCP para apoiar o agente."
    ],
    "gap": "A transcrição não contém os comandos necessários para instalação ou integração.",
    "extracted": [],
    "example": "Explorar um efeito visual discreto para a capa de uma página de produto, com alternativa estática.",
    "prompt": "Planeje um protótipo de efeito visual para uma página de produto usando [biblioteca]. Primeiro confirme a documentação e exemplos oficiais. Explique como oferecer uma alternativa estática, respeitar preferência por movimento reduzido e manter boa leitura no celular. Não invente APIs."
  },
  "278e26cd-a47f-4dd0-814f-aebd47e9ea47": {
    "topics": [
      "prompts",
      "imagens"
    ],
    "goal": "Transformar um material de leitura em um resumo visual.",
    "tools": [
      "Google Gemini"
    ],
    "complete": true,
    "steps": [
      "Anexe o material que deseja resumir.",
      "Escolha um formato citado pelo autor, como FLUXOGRAMA ou MIND MAP.",
      "Peça o resumo no formato escolhido."
    ],
    "gap": "Os exemplos não substituem a conferência do resultado com o material original.",
    "extracted": [
      "INFOGRAPH",
      "APRENDIZADO VISUAL",
      "FLUXOGRAMA",
      "NOTAS RESUMO",
      "QUADRINHOS DIDÁTICOS",
      "MIND MAP",
      "STICK NOTES",
      "INFOCHART"
    ],
    "example": "Resumir um manual de trabalho em tópicos e relações entre procedimentos.",
    "prompt": "Crie um mapa mental do documento anexado. Use apenas informações presentes nele. Organize assunto central, conceitos, etapas e exceções. Indique páginas ou seções de origem quando disponíveis. Marque lacunas como “não informado”."
  },
  "fcf20104-1d59-4342-a7a3-9281ceeab56c": {
    "topics": [
      "sites",
      "prompts"
    ],
    "goal": "Preparar a ideia de um aplicativo para experimentar no Replit.",
    "tools": [
      "Replit"
    ],
    "complete": true,
    "steps": [
      "O texto da tela orienta abrir Replit.com.",
      "Cole o prompt do aplicativo.",
      "Aguarde a geração e examine o resultado."
    ],
    "gap": "O prompt usado na demonstração não está no conteúdo extraído; a tela pede um comentário para recebê-lo.",
    "extracted": [],
    "example": "Um protótipo de catálogo com dados fictícios para testar navegação e filtros.",
    "prompt": "Crie um protótipo de catálogo de produtos com dados fictícios identificados. Inclua pesquisa sem distinguir maiúsculas ou acentos, categorias, ficha com foto, descrição e medidas, e layout responsivo. Não conecte serviços pagos nem publique. Liste os requisitos que precisam ser confirmados."
  },
  "4aa2939b-7c1a-4a21-8494-4d13c4953460": {
    "topics": [
      "agentes",
      "automacao"
    ],
    "goal": "Desenhar a divisão de tarefas de uma equipe de assistentes de IA.",
    "tools": [
      "Telegram",
      "Assistentes de IA"
    ],
    "complete": false,
    "steps": [
      "A demonstração separa atividades como design, tráfego, copy e social media.",
      "O autor envia pedidos por áudio e acompanha respostas e materiais nos grupos.",
      "Use a demonstração para listar quais tarefas da sua rotina poderiam receber apoio."
    ],
    "gap": "A fonte não identifica a implementação completa, integrações ou configuração dos agentes. A promessa de produtividade não foi validada.",
    "extracted": [],
    "example": "Organizar um fluxo de catálogo: conferir dados do produto, preparar texto, revisar arte e aprovar publicação.",
    "prompt": "Desenhe um fluxo de apoio por IA para criar um catálogo. Separe coleta de dados, texto, revisão técnica, design e aprovação humana. Para cada etapa informe entrada, saída, responsável e critério de conclusão. Não envie mensagens nem publique materiais."
  },
  "93932679-3f55-4b15-8e40-993849a29aa1": {
    "topics": [
      "sites",
      "prompts"
    ],
    "goal": "Organizar uma referência visual antes de pedir uma página à IA.",
    "tools": [
      "Ferramenta de criação de sites com IA"
    ],
    "complete": true,
    "steps": [
      "Escolha uma boa referência visual.",
      "Extraia fontes, cores, espaçamentos e animações usados na referência.",
      "Reúna esses elementos em uma instrução detalhada junto com a referência.",
      "Peça a geração da página e refine o resultado."
    ],
    "gap": "O prompt completo e a ferramenta de extração não foram disponibilizados na transcrição.",
    "extracted": [],
    "example": "Uma página de apresentação do catálogo com identidade própria, usando uma referência para orientar a composição.",
    "prompt": "Analise a referência anexada e descreva hierarquia visual, cores, tipografia, espaçamento e comportamento responsivo. Separe observações de hipóteses. Depois proponha uma página original para [produto], com identidade [marca], sem inventar especificações ou depoimentos."
  },
  "e92e8551-fae7-4b67-859c-f6f09bc89af1": {
    "topics": [
      "videos"
    ],
    "goal": "Preparar uma versão traduzida de um vídeo e revisar legendas e áudio.",
    "tools": [
      "VMEG AI"
    ],
    "complete": true,
    "steps": [
      "Abra a função Tradutor de vídeo apresentada na demonstração.",
      "Envie o arquivo ou informe um link aceito pela ferramenta.",
      "Selecione o idioma de destino e envie para processamento.",
      "Abra o editor para conferir tradução, fala, legendas e duração."
    ],
    "gap": "Preços, créditos e limites de duração citados pelo autor não foram confirmados. Use conteúdo e voz que você tenha autorização para adaptar.",
    "extracted": [],
    "example": "Preparar uma demonstração de produto em inglês e revisar os termos técnicos antes de publicar.",
    "prompt": "Revise esta tradução de um vídeo de produto comparando original e versão traduzida. Preserve nomes, medidas e termos técnicos. Liste trechos com sentido alterado, pronúncia a conferir e legendas longas. Não acrescente benefícios ou especificações ausentes."
  }
};
