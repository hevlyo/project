# Pega Bola 3000

Monorepo de jogo multiplayer em tempo real.

## Arquitetura (visão estável)

- `apps/server`: backend e regras de jogo.
- `apps/game`: cliente web/renderização.
- `packages/shared`: contratos e tipos compartilhados entre apps.

## Regras do Repositório

- TypeScript como linguagem padrão para código novo.
- Mudanças de comportamento devem ser cobertas por testes.
- Correções de bug exigem teste de regressão.
- Contratos compartilhados devem evoluir com compatibilidade explícita e validação.

## Como Navegar

- A fonte da verdade operacional está no próprio repositório: configurações e scripts em `package.json`, `tsconfig*`, configs de testes e scripts de deploy.
- Evite depender de documentação estática para comandos/paths que mudam com frequência.
