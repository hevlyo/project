# Pega Bola 3000

Jogo multiplayer em tempo real em que os jogadores entram, coletam bolas, crescem e disputam a liderança.

## Stack

- Frontend em HTML, CSS e JavaScript carregado diretamente pelo navegador
- Servidor em TypeScript com Node.js e Express
- Socket.IO para sincronização em tempo real
- Three.js no cliente para renderização 3D

## Assets

- Modelos 3D externos da Khronos glTF Sample Assets, incluindo `Lantern` e `Diffuse Transmission Plant`
- Assets baixados e servidos localmente em `public/assets/models/`

## Requisitos

- Node.js 18 ou superior
- Bun

## Instalação

```bash
bun install
```

## Execução

```bash
bun run start
```

Depois, abra:

```text
http://localhost:25565
```

## Controles

- `WASD` para mover
- `Space` para dash
- `f` para fullscreen
- `Esc` para sair do fullscreen

## Loop Atual

- Entrar com nickname
- Movimentar pelo mapa
- Coletar bolas para ganhar pontos e crescer
- Disputar ranking
- Respawn com proteção curta
- Reconnect curto sem duplicar o jogador local

## Arquitetura e Manutenibilidade

- O servidor usa uma fronteira explícita (`GameStatePort`) no `SocketManager` para reduzir acoplamento com a implementação concreta do estado do jogo.
- O frontend iniciou migração para TypeScript com módulos puros em `src/frontend/client/`, compilados para `public/js/client/`.
- A lógica de HUD foi extraída para `src/frontend/client/gameHud.ts`, facilitando evolução e testes isolados.

## Testes e E2E Readiness

- Priorize regras de negócio em funções puras (como no módulo de HUD) para simplificar cobertura unitária.
- Use os hooks de depuração existentes do app para smoke tests E2E sem acoplar o teste à renderização frame a frame.
- Em cada nova feature, adicione pelo menos um teste de regressão no servidor (`src/**.test.ts`) antes de alterar o fluxo do cliente.

## Estrutura

```text
├── public/      # Cliente, HTML e assets
├── src/         # Config, estado do jogo e socket layer
├── server.ts    # Entrada do servidor
├── dist/        # Saída gerada no build
└── package.json
```

## Scripts

- `bun run build`: compila o TypeScript
- `bun run start`: compila e inicia o servidor
- `bun run test`: roda os testes
- `bun run deploy:prod`: faz o deploy de produção
