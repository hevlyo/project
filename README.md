# Pega Bola 3000

Um jogo multiplayer em tempo real onde os jogadores competem para coletar bolas em um ambiente 3D.

## 🚀 Tecnologias Utilizadas

- **Frontend**:
  - Three.js para renderização 3D
  - Socket.IO para comunicação em tempo real
  - HTML5 e CSS3 moderno
  - JavaScript ES6+

- **Backend**:
  - Node.js
  - Express.js
  - Socket.IO
  - Three.js (server-side)

## 📋 Pré-requisitos

- Node.js (versão 14 ou superior)
- NPM ou Yarn

## 🔧 Instalação

1. Clone o repositório:

```bash
git clone [URL_DO_REPOSITÓRIO]
```

1. Instale as dependências:

```bash
npm install
```

1. Inicie o servidor:

```bash
npm start
```

1. Acesse o jogo em:

```url
http://localhost:3000
```

## 🎮 Como Jogar

1. Digite seu nome de usuário na tela inicial
2. Use as teclas WASD para mover seu personagem
3. Colete as bolas para ganhar pontos
4. Evite colisões com outros jogadores
5. O jogador com mais pontos vence!

## 🏗️ Estrutura do Projeto

```text
├── public/              # Arquivos estáticos
│   ├── assets/         # Recursos visuais
│   ├── js/             # Scripts do cliente
│   └── index.html      # Página principal
├── src/                # Código fonte
│   ├── config/         # Configurações do jogo
│   ├── game/           # Lógica do jogo
│   ├── models/         # Modelos 3D
│   ├── socket/         # Gerenciamento de sockets
│   └── utils/          # Utilitários
├── server.js           # Ponto de entrada do servidor
└── package.json        # Dependências e scripts
```

## 🔄 Funcionalidades

- **Multiplayer em Tempo Real**: Jogue com outros jogadores online
- **Física 3D**: Sistema de colisão e movimento realista
- **Sistema de Pontuação**: Competição por pontos
- **Interface Intuitiva**: Design moderno e responsivo
- **Personalização**: Escolha seu nome de usuário

## 🛠️ Desenvolvimento

### Scripts Disponíveis

- `npm start`: Inicia o servidor de desenvolvimento
- `npm run dev`: Inicia o servidor com hot-reload (se configurado)

### Padrões de Código

- Utilizamos ES6+ para o código JavaScript
- Seguimos o padrão de módulos do Node.js
- Comentários JSDoc para documentação do código

## 🤝 Contribuindo

1. Faça um fork do projeto
1. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
1. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
1. Push para a branch (`git push origin feature/AmazingFeature`)
1. Abra um Pull Request

## 📝 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

Para suporte, envie um email para [hevlyo@gmail.com] ou abra uma issue no GitHub.

---

Desenvolvido com ❤️ por [Riquelme]
