# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Desenvolvedores back-end e full-stack (JS/TS em primeiro lugar) que querem enviar
prompts de texto ao Gemini sem passar pela API oficial paga do Google. A situação
típica é um projeto pessoal, protótipo, bot ou ferramenta interna onde o custo por
token não se justifica e a burocracia de billing/API key atrapalha mais do que ajuda.

O trabalho que estão fazendo: integrar geração de texto em algo que já existe, com o
menor atrito possível, copiar um cURL, ver funcionar, seguir em frente.

Audiência secundária confirmada: recrutadores e revisores técnicos avaliando o
projeto como peça de portfólio de Felipe Estrela.

## Product Purpose

Expor o Gemini web como uma API REST simples. O cliente cria uma sessão
(`POST /create-session`) e envia mensagens (`POST /chat`), recebendo
`{ ok: true, reply: "..." }`.

Sucesso: um dev sai de zero para uma resposta do Gemini em menos de um minuto,
copiando e colando comandos, sem instalar SDK nem criar conta.

## Positioning

Proxy HTTP fino: replica em `fetch` nativo a requisição `StreamGenerate` que o
navegador faria em gemini.google.com, e parseia o stream de volta.

O que um vizinho não copia honestamente: **não usa Puppeteer nem navegador headless,
não usa o SDK oficial `@google/genai` no fluxo principal, e não tem custo por token.**
As soluções concorrentes desse nicho quase sempre sobem um Chrome headless, pesado,
lento e frágil em produção. Aqui não há browser envolvido.

## Operating Context

Consumido via `curl`, `fetch`, Postman ou Insomnia, a partir do terminal ou de um
back-end. O dev avalia o projeto lendo o README no GitHub e/ou abrindo o Swagger UI.

Instância pública ativa: **https://freegemini.felipeestrela.com.br**
Swagger UI em `/docs`, spec OpenAPI 3.0 em `/openapi.json`.
Também roda local em `http://localhost:3333`.

Fluxo interno: `create-session` faz um `POST StreamGenerate` sem cookie, captura os
cookies do `Set-Cookie`, salva o snapshot em SQLite e devolve um JWT. Cada `/chat`
usa os cookies daquela sessão e os renova a partir da resposta.

## Capabilities and Constraints

Endpoints: `GET /`, `POST /create-session`, `POST /chat`,
`GET|POST /session/status`, `GET /docs`, `GET /openapi.json`.

Stack: Node.js 18+ (fetch nativo), Elysia + `@elysiajs/node`, `@elysiajs/cors`,
jsonwebtoken, Drizzle ORM + libSQL (SQLite), dotenv.

Limites confirmados, todos factuais e que a página **não pode maquiar**:

- Só texto. Não aceita upload de arquivos nem imagens.
- Não mantém histórico de conversa entre chamadas `/chat`.
- Não renova cookies automaticamente, quando o Google muda o protocolo, o template
  em `src/config/gemini.js` precisa ser atualizado à mão via DevTools.
- Sessão expira em 45 min (`SESSION_TTL_MINUTES`), depois retorna `SESSION_EXPIRED`.
- Prompt máximo de 20.000 caracteres.
- Rate limits por IP: `create-session` 1/15s, `chat` 30/min, `status` 60/min.
- Timeout de até 120s na chamada ao Gemini.

Latência: o gargalo é o Gemini (chamada HTTP externa + parse de stream), não o
framework. A escolha do Elysia sobre Express muda milissegundos numa resposta que
leva segundos, isso é declarado abertamente no README e deve continuar sendo.

**Natureza não-oficial (decisão confirmada: assumir explicitamente na página).**
Projeto independente e não afiliado ao Google. Não usa API pública documentada;
depende de um endpoint interno do gemini.google.com e quebra quando ele muda.
Uso de estudo/pessoal.

## Brand Commitments

Nome: **Free Gemini API**. Autor: Felipe Estrela · github.com/lipey1. Licença ISC.

Identidade visual já definida e vinculante em `brand/brand-guide.html`
(direção "Terminal Dark", v1.0): paleta, tipografia Inter + JetBrains Mono, logo em
SVG de dois chevrons espelhados com ponto central, regra 90/10 de cor, e o mapeamento
semântico mint=200 / amber=429 / rose=erro / azul=request.

Tagline: *"Gemini via REST. Sem SDK, sem browser, sem custo."*

Voz: específica e sem hype. Declara limites antes que o dev os descubra em produção.
Erro é instrução, não desculpa. Mostra cURL que roda em vez de prometer "integração
intuitiva". Nunca superlativo, "resposta em ~1.8s, o gargalo é o Gemini", não
"ultrarrápido".

## Evidence on Hand

Real e utilizável: os endpoints, os payloads de request/response, a tabela de rate
limits, os códigos de erro (`doc/ERROR_CODES.md`), o diagrama Cliente → API → Gemini,
os exemplos de cURL e JavaScript, e a comparação honesta Express/Fastify/Elysia, tudo
já escrito e verificado no README. A instância pública é demonstrável ao vivo.

**Ausências que trabalhos futuros não podem fabricar:** não há usuários, testes de
carga, benchmarks próprios, estrelas no GitHub, depoimentos, empresas usando, número
de requisições servidas, uptime medido, nem suíte de testes (`npm test` é um echo).
A latência de ~1.8s é ordem de grandeza observada, não medida publicada, se aparecer
na página, deve ser apresentada como aproximação, nunca como métrica auditada.

## Product Principles

1. **O limite vem antes da promessa.** Toda capacidade anunciada carrega sua restrição
   junto. A seção "o que este projeto não faz" é ativo, não errata.
2. **O cURL é o argumento.** Demonstração executável supera qualquer adjetivo ou
   ilustração. Se dá para provar copiando e colando, não se descreve com prosa.
3. **Fino é a proposta.** Sem browser, sem SDK, sem fila, sem ORM pesado. Qualquer
   adição precisa justificar por que não contraria a razão de existir do projeto.
4. **Honestidade técnica é a credencial.** Admitir que outro framework serviria, ou
   que o projeto depende de um endpoint não documentado, sinaliza mais senioridade do
   que qualquer superlativo, e é o que faz a peça funcionar no portfólio.
5. **O erro ensina o próximo passo.** Toda falha diz ao cliente o que fazer agora.

## Accessibility & Inclusion

Nenhum requisito específico do produto foi estabelecido pelo usuário. Aplicar o padrão
do ofício: WCAG 2.1 AA de contraste, navegação completa por teclado com foco visível,
e respeito a `prefers-reduced-motion`.

Decisão confirmada: a landing é **dark-only** e bilíngue **inglês com toggle para
português** (README e mensagens de erro permanecem em português).
