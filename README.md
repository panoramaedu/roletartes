
## ✨ Funcionalidades

- 🎡 Roleta dinâmica que se adapta à quantidade de imagens
- 🎨 Cores educacionais sem repetição adjacente
- 📤 Upload de imagens locais (armazenadas em base64)
- 🔗 Suporte a URLs remotas
- 🔊 Efeitos sonoros (com opção de mutar)
- 🌓 Temas claro e escuro
- 💾 Salvamento automático (localStorage)
- 📂 Exportar/importar configurações em JSON
- 📜 Histórico dos últimos sorteios
- ⛶ Modo apresentação (tela cheia)
- 📱 Totalmente responsivo

## 🚀 Como usar

1. **Links remotos:** Cole URLs no textarea (uma por linha)
2. **Imagens locais:** Clique na área de upload ou arraste arquivos
3. Clique em **Carregar** para combinar tudo
4. Clique na roleta para girar
5. Quando a imagem aparecer, escolha:
   - ⭐ **Remover** — tira a imagem da roleta
   - ▶ **Continuar** — mantém a imagem
   - 🔄 **Sortear de novo** — gira novamente

### Atalhos de teclado
- `ESPAÇO` — girar a roleta
- `ESC` — fechar modais

## 📦 Deploy no GitHub Pages

1. Crie um repositório no GitHub (ex.: `roletartes`)
2. Faça upload dos 3 arquivos (`index.html`, `style.css`, `script.js`)
3. Vá em **Settings → Pages**
4. Selecione a branch `main` e pasta `/root`
5. Acesse a URL: `https://SEU-USUARIO.github.io/roletartes/`

## ⚠️ Limitações

- **localStorage:** ~5MB total (imagens locais em base64 consomem mais espaço)
- **Recomendação:** comprima imagens grandes antes de upload
- **Aviso automático:** o sistema alerta quando está perto do limite

## 🛠️ Tecnologias

- HTML5 + CSS3 + JavaScript puro
- Canvas API para a roleta
- Web Audio API para efeitos sonoros
- Zero dependências externas
