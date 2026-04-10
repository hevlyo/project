# Pega Bola 3000

Jogo multiplayer em tempo real em que os jogadores entram, coletam bolas, crescem, disputam a liderança e podem consumir outros jogadores quando a regra de intenção permite.

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
- `R` para tentativa de consumo
- `f` para fullscreen
- `Esc` para sair do fullscreen

## Loop Atual

- Entrar com nickname
- Movimentar pelo mapa
- Coletar bolas para ganhar pontos e crescer
- Disputar ranking
- Consumir jogadores menores quando houver intenção ativa
- Respawn com proteção curta
- Reconnect curto sem duplicar o jogador local

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
