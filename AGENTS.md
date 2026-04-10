# AGENTS

## Regra obrigatoria para novos codigos

- Todo novo codigo deste repositorio deve ser escrito em TypeScript.
- Nao criar novos arquivos `.js` para features, modulos, componentes, utilitarios ou logica nova.
- Ao alterar partes legadas em JavaScript, manter compatibilidade, mas priorizar migracao para `.ts`/`.tsx` quando viavel.
- Excecoes so sao permitidas para arquivos gerados automaticamente por ferramentas externas.

## Regra obrigatoria de runtime e pacotes

- Sempre usar `bun` para executar scripts do projeto.
- Sempre usar `bun` para instalar, remover ou atualizar dependencias.

## Checklist rapido antes de abrir PR

- Novos arquivos de codigo usam extensao `.ts` ou `.tsx`.
- Tipos explicitos para APIs publicas (funcoes, classes, contratos de dados).
- Sem uso de `any` sem justificativa documentada.
