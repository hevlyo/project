# Pega Bola 3000

## Estrutura

```text
repo/
  package.json
  bun.lock
  tsconfig.base.json

  apps/
    server/   # backend Bun + Socket.IO
    game/     # frontend Three.js + Vite

  packages/
    shared/   # tipos, DTOs e contratos compartilhados
```

## Stack

- Backend: Bun + Node.js + Express + Socket.IO
- Frontend: TypeScript + Three.js + Vite
- Shared package: contratos e tipos TypeScript reaproveitáveis
- Testes: Vitest (backend e utilitários), Playwright (E2E)

## Instalação

```bash
bun install
```

## Scripts (raiz)

- `bun run build`: build de `packages/shared`, `apps/game` e `apps/server`
- `bun run start`: comando unico local (mesmo fluxo de prod): build completo + `node apps/server/dist/server.js`
- `bun run test`: roda testes do backend
- `bun run test:e2e`: roda E2E do backend/frontend integrado
- `bun run deploy`: deploy de produção

## Pacotes

### apps/server

- Código do servidor e regras do jogo em `apps/server/src`
- Entrada do backend em `apps/server/server.ts`
- Serve estáticos de `apps/game/dist` (build Vite)

### apps/game

- Entrada do cliente em `apps/game/src/main.ts`
- Assets estáticos em `apps/game/public`
- HTML de entrada em `apps/game/index.html`

### packages/shared

- Tipos compartilhados em `packages/shared/src/contracts.ts`

## Execução local

1. Rode `bun run start`
2. Abra `http://localhost:25565`

Esse fluxo local é o mesmo padrão usado em produção: build completo e execução do servidor compilado.
