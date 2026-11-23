# Painel RP 2027 · Dellamed

Painel de eventos e patrocínios da equipe de Relações Públicas. É o mesmo dash do claude.ai, agora como site no GitHub Pages, com login Google, cadastro de usuários e registro de alterações.

## O que tem aqui

| Arquivo | Para que serve |
|---|---|
| `index.html` | O painel (calendário, eventos, patrocínios) |
| `admin.html` | Administração: usuários, registro de alterações, cópia e importação de dados |
| `assets/js/app.js` | Telas e regras do painel (mesma lógica da versão claude.ai) |
| `assets/js/nuvem.js` | Login Google, banco Firestore e gravação dos logs |
| `assets/js/admin.js` | Tela de administração |
| `assets/js/config.js` | **Você preenche:** configuração do projeto Firebase |
| `firestore.rules` | **Você cola no Firebase:** quem pode ler, editar e administrar |

Papéis: **Leitura** vê tudo e baixa Excel. **Editor** também altera eventos e patrocínios. **Administrador** também exclui eventos, cadastra pessoas, vê o registro de alterações e restaura versões.

## Colocar no ar (uma vez, uns 20 minutos)

### 1. Firebase
1. Entre em [console.firebase.google.com](https://console.firebase.google.com) com a conta Google da Dellamed e crie um projeto (ex.: `painel-rp-dellamed`). O Google Analytics pode ficar desligado.
2. **Authentication › Começar › Método de login › Google › Ativar.** Escolha o e-mail de suporte e salve.
3. **Firestore Database › Criar banco de dados › Modo de produção.** Local: `southamerica-east1 (São Paulo)`.
4. **Firestore › Regras:** apague o que estiver lá, cole o conteúdo de `firestore.rules`, troque `admin_inicial@dellamed.com.br` pelo seu e-mail Google (em minúsculas) e clique em **Publicar**.
5. **Configurações do projeto (engrenagem) › Seus apps › Web (`</>`)**: dê um nome, não marque Hosting, e copie o bloco `firebaseConfig`. Cole os valores em `assets/js/config.js`.

### 2. GitHub Pages
1. Crie um repositório (ex.: `painel-rp`) e suba **todos** os arquivos desta pasta, mantendo as subpastas.
2. **Settings › Pages › Build and deployment:** *Deploy from a branch*, branch `main`, pasta `/ (root)`. Em um minuto o site fica em `https://SEU-USUARIO.github.io/painel-rp/`.
3. Volte ao Firebase: **Authentication › Configurações › Domínios autorizados › Adicionar domínio** e coloque `SEU-USUARIO.github.io`.

### 3. Primeiro acesso
1. Abra o site e entre com o e-mail que você colocou nas regras. Você entra como Administrador.
2. **Administração › Dados › Importar dados:** escolha `migracao-dash-eventos.json` (entregue à parte, **não suba esse arquivo para o GitHub**) e confirme.
3. **Administração › Usuários:** cadastre a equipe. Cada pessoa entra com a própria conta Google do e-mail cadastrado.

## Segurança
- O repositório pode ser público: o código não tem dados. Os valores de `config.js` identificam o projeto e não dão acesso a nada; quem protege os dados são as regras do Firestore.
- Quem não está cadastrado (ou está bloqueado) não lê nada, nem chamando o banco direto.
- Ninguém apaga ou reescreve o registro de alterações. Cada registro guarda a versão anterior do evento, e o administrador pode restaurar.

## Atualizar o site depois
- Suba os arquivos alterados juntos, num commit só.
- Ao mudar CSS ou JS, troque o `?v=1` dos links em `index.html` e `admin.html` (ex.: `?v=2`) para o navegador de todo mundo pegar a versão nova.
- Nunca use `git push --force`.

## Limites do plano gratuito (Spark)
50 mil leituras e 20 mil gravações por dia no Firestore. Para uma equipe de RP, sobra bastante. Se um dia passar, o painel avisa “Limite diário do banco atingido” e volta a gravar no dia seguinte.

## O que mudou em relação ao dash do claude.ai
- Login com Google e papéis por pessoa, no lugar do compartilhamento do claude.ai.
- Registro de alterações com quem, quando e o quê, e restauração de versões.
- Busca de eventos e patrocínios na tela inicial.
- Botão **Histórico** no topo de cada evento (só para administradores).
- “Baixar Excel” funciona direto no navegador.
- O painel “Perguntar ao Claude” sobre o orçamento não existe fora do claude.ai e fica escondido.

Saúde e bem-estar para todos.
