# SB Instagram

Ferramenta open source e sem fins lucrativos para supermercados criarem as artes de ofertas que publicam no Instagram. Você bipa ou digita o código do produto, informa o preço e o app monta o pôster pronto para postar, com a identidade visual do seu mercado.

O projeto nasceu no Supermercado Baratão e foi pensado para qualquer supermercado usar.

## Como funciona

- **Auto-hospedado:** cada mercado roda a própria instância a partir de uma imagem Docker. Não existe serviço central: os dados do seu mercado ficam só na sua instância.
- **Dados locais:** produtos, ofertas e configurações ficam num banco SQLite, e as fotos enviadas pelo mercado ficam no mesmo volume de dados do container.
- **Marca configurável:** logo, cores, slogan e @ do Instagram são definidos no próprio app.
- **Produtos por código:** cada produto é encontrado pelo código de barras (EAN) ou, quando não tem um (carnes, hortifrúti, padaria), pelo código interno do mercado. Um produto pode ter vários códigos, como as fragrâncias de um sabonete anunciadas com uma só foto, e um código pode estar em mais de um produto (a fragrância sozinha e o grupo), contanto que dois produtos não tenham os mesmos códigos. Bipar um produto já usado preenche nome, marca, unidade e foto automaticamente. O código é lido por leitor USB ou digitado, e o botão **Cadastrar produto** fica em **Produtos** e em cada espaço de produto da oferta.
- **Catálogo comunitário:** o repositório mantém um catálogo aberto a contribuições, com fotos e dados de produtos por EAN (`catalog/ean/`) e uma pasta de fotos de produtos sem EAN, nomeadas pela descrição (`catalog/no-ean/`, ex.: `picanha-bovina.png`). Como o código interno muda de mercado para mercado, cada mercado associa uma dessas fotos ao próprio código. Para contribuir com produtos, veja o [`CONTRIBUTING.md`](./CONTRIBUTING.md).

Ainda não fazem parte da primeira versão: login, leitura do código pela câmera, publicação direta no Instagram, agendamento de posts, legendas geradas por IA e editor visual de artes.

## Começando

### Instalando no mercado

Os guias passo a passo, para quem não é desenvolvedor, ficam na pasta [`guias/`](./guias/):

- [Instalação](./guias/instalacao.md): instalar o Docker, subir o app e abri-lo nas outras máquinas da rede.
- [Atualização](./guias/atualizacao.md): instalar uma versão nova sem perder os dados.
- [Backup e restauração](./guias/backup.md): guardar e recuperar uma cópia dos dados do mercado.

### Rodando com Docker

Com o [Docker](https://docs.docker.com/get-docker/) instalado, na pasta do `compose.yaml`:

```bash
docker compose up -d
```

Abra [http://localhost:3000](http://localhost:3000) no navegador. Para parar, use `docker compose down`.

O `compose.yaml` usa a imagem publicada em `ghcr.io/supermercado-baratao/sb-instagram`, para `linux/amd64` e `linux/arm64`. Para montar a imagem a partir do código, na raiz do repositório, use o compose de desenvolvimento:

```bash
docker compose -f compose.dev.yaml up -d --build
```

Os dados da instância (banco e fotos enviadas) ficam no volume nomeado `data`, montado em `/data` dentro do container. Eles continuam lá depois de `docker compose down` ou de atualizar a imagem; só são apagados com `docker compose down --volumes`. O diretório de dados é definido pela variável de ambiente `DATA_DIR`.

### Desenvolvimento

Instale as dependências, o Chromium (usado para gerar o PNG do pôster e pelos testes E2E) e inicie o servidor de desenvolvimento (versão do Node no `.nvmrc`, gerenciador de pacotes: pnpm):

```bash
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

Abra [http://localhost:3000](http://localhost:3000) no navegador. Fora do Docker, os dados ficam em `data/` na raiz do projeto (ignorada pelo git), a menos que `DATA_DIR` aponte para outro lugar.

No primeiro acesso, o app pede a marca do mercado (nome, logo, slogan, @ do Instagram e as cores dos modelos de arte) antes de liberar as ofertas e os produtos. Para mudar depois, use o botão **Marca** em **Ofertas** (`/configuracoes`).

### Usando uma imagem sem EAN

Os produtos sem código de barras (carnes, hortifrúti, padaria) são identificados pelo código interno do seu mercado, o mesmo usado no caixa ou na balança. O catálogo não conhece esse código, então a foto é associada a ele no seu mercado:

1. Escolha a imagem em [`catalog/no-ean/`](./catalog/no-ean/), pelo nome da descrição do produto (ex.: `picanha-bovina.png`).
2. Em **Produtos** (`/produtos`), clique em **Cadastrar produto** (ou bipe ou digite o código interno no campo da página) e escolha essa imagem em "Ou escolha uma imagem do catálogo". O app copia a imagem para o diretório de dados da instância.

## Scripts

| Script                                      | O que faz                                                   |
| ------------------------------------------- | ----------------------------------------------------------- |
| `pnpm dev`                                  | Inicia o servidor de desenvolvimento                        |
| `pnpm build`                                | Gera o build de produção                                    |
| `pnpm start`                                | Serve o build de produção                                   |
| `pnpm type-check`                           | Gera os tipos das rotas e checa os tipos com `tsc --noEmit` |
| `pnpm eslint:check` / `pnpm eslint:fix`     | Analisa (e corrige) o código com o ESLint                   |
| `pnpm prettier:check` / `pnpm prettier:fix` | Confere (e reescreve) a formatação                          |
| `pnpm test` / `pnpm test:watch`             | Roda os testes unitários (Vitest)                           |
| `pnpm test:e2e` / `pnpm test:e2e:ui`        | Roda os testes end-to-end (Playwright)                      |
| `pnpm catalog:check`                        | Valida os arquivos do catálogo comunitário                  |
| `pnpm catalog:optimize`                     | Redimensiona e comprime as imagens do catálogo              |
| `pnpm db:generate`                          | Gera uma migration a partir do schema do banco              |
| `pnpm db:studio`                            | Abre o Drizzle Studio no banco local                        |
| `pnpm shadcn:add <name>`                    | Adiciona um componente do shadcn/ui                         |

## Como contribuir

O planejamento e as tarefas ficam nas [issues](https://github.com/supermercado-baratao/sb-instagram/issues), organizadas por milestone. O fluxo completo, do planejamento ao merge, está em [`docs/development-workflow.md`](./docs/development-workflow.md), e as convenções detalhadas estão no [`AGENTS.md`](./AGENTS.md).

## Convenções do projeto

Abaixo estão os destaques das convenções.

### Idioma

- **Português:** este README, o `CONTRIBUTING.md`, os guias para os mercados em `guias/`, as issues (título e corpo), o template de issue e todos os textos exibidos no app.
- **Inglês:** código (nomes e comentários), mensagens de commit, nomes de branch, pull requests (título e corpo), `AGENTS.md`, `docs/` e o workflow de IA em `.claude/`.

### Ferramentas

- **Gerenciador de pacotes:** apenas pnpm. As versões em `dependencies` e `devDependencies` são fixadas exatas (instale com `pnpm add -E <pkg>`).
- **Node:** versão fixada no `.nvmrc` (`lts/krypton`) e, para ambientes que ignoram o `.nvmrc`, no `engines.node` (`24.x`) do `package.json`.
- **React Compiler:** ativado com `reactCompiler: true` no `next.config.ts`.
- **Alias de caminho:** `@/*` aponta para `src/*`.

### Banco de dados

- SQLite com **Drizzle ORM** 1.0 (linha `1.0.0-rc`, a mesma da documentação atual do Drizzle) e o driver `better-sqlite3`. O banco é o arquivo `database.sqlite` no diretório de dados.
- O cliente, o schema e as migrations ficam em `src/infra/database`. As migrations pendentes são aplicadas automaticamente quando a aplicação inicia, no `pnpm dev` e no container.
- Os produtos da instância ficam na tabela `products`, identificados por um id (UUID), e os códigos deles (EAN ou código interno) na tabela `product_codes`, sem código principal. A busca por código procura primeiro na instância e, para um EAN, no catálogo comunitário, que encontra o produto pelo EAN do nome do arquivo ou por um dos EANs do campo `codes`; ao ser usado, o produto do catálogo é salvo na instância com todos os EANs e uma cópia da foto em `photos/`, no diretório de dados.
- Um produto pode ter vários códigos, na seção "Códigos" do formulário, para as variações vendidas com a mesma foto (as fragrâncias de um sabonete, por exemplo). Um código pode estar em vários produtos, para anunciar uma fragrância sozinha sem mexer no grupo (e nas ofertas que já o usam), mas dois produtos não podem ter o mesmo conjunto de códigos: o app recusa e diz qual produto já tem esses códigos. Quando o código bipado está em mais de um produto, em `/produtos` ou no editor de ofertas, o app pergunta qual usar, com o produto sozinho antes dos grupos.
- Em `/produtos`, abaixo do campo de código, fica a lista dos produtos da instância, com pesquisa por nome ou código e 50 produtos por página (`?q=` e `?pagina=` na URL). Clicar num produto abre o mesmo formulário da busca por código. A lixeira de cada linha exclui o produto e a foto dele, depois de confirmar; um produto que está em alguma oferta não pode ser excluído, e o app mostra em quais ofertas ele está.
- Para juntar produtos cadastrados separados por engano (duas fragrâncias, por exemplo), marque-os na lista de `/produtos` (a seleção continua ao pesquisar ou mudar de página) e clique em **Mesclar**. Você escolhe o produto que fica, com nome, marca, unidade e foto dele, e o app mostra os códigos que passam para ele e as ofertas que mudam antes de confirmar. Os outros produtos são excluídos com as fotos, e as ofertas que os usavam passam a usar o produto que fica (se ele aparecer duas vezes na mesma página, fica só a primeira posição). Para anunciar só algumas fragrâncias, cadastre um produto individual ou um grupo menor em vez de separar o grupo.
- Ao cadastrar um código novo, **Adicionar a um produto existente** procura o produto por nome e acrescenta o código a ele, para uma variação nova de um produto que já está cadastrado.
- A marca fica na tabela `brand` (uma única linha) e os modelos de arte na tabela `templates`, editados em `/configuracoes`. Enquanto a marca não foi salva, as páginas que a usam levam ao primeiro acesso nessa tela. O logo é salvo como `logo.png` no diretório de dados (no máximo 600 px, mantendo a proporção e a transparência) e servido em `/marca/logo`. Uma página de oferta cujo modelo foi removido passa a usar o primeiro modelo da lista.
- As ofertas ficam nas tabelas `offers`, `offer_pages` e `offer_page_items`: a oferta guarda o nome, a validade e o destaque; cada página guarda o modelo de arte e o layout; e cada produto da página guarda a posição, o id do produto e o preço. A lista de ofertas fica em `/ofertas`.
- O editor da oferta fica em `/ofertas/<id>`: os textos valem para todas as páginas, e cada página tem modelo de arte, quantidade de produtos (9, 6, 4 ou 3) e os produtos, colocados pelo código (com o leitor ou digitando e apertando Enter) com o preço. Ao digitar no espaço do produto, o app sugere produtos já cadastrados no mercado por nome, marca, unidade ou código, sem diferenciar maiúsculas e acentos; escolher uma sugestão coloca o produto na página. Um código que ainda não foi cadastrado pode ser cadastrado ali mesmo, em **Cadastrar produto**, e o produto entra direto na página. O lápis de um produto já colocado abre os dados dele para corrigir (nome, marca, unidade, códigos e foto); a alteração é salva na hora e vale para todas as ofertas que usam o produto. A pré-visualização do pôster fica ao lado, e as alterações só valem depois de clicar em "Salvar". Ao sair do editor com alterações não salvas, por um link da página ou fechando a aba, aparece um aviso pedindo confirmação.
- "Baixar páginas (PNG)" gera um arquivo ZIP com uma imagem por página (`pagina-1.png`, `pagina-2.png`...), na ordem da oferta.
- "Exportar para o catálogo", em `/produtos`, gera `catalogo.zip` com as pastas `ean/` e `no-ean/` no formato do catálogo comunitário, para o mercado devolver ao catálogo os produtos que fotografou. Entram os produtos com EAN que têm marca, unidade e foto com fundo transparente (um produto com vários EANs leva os outros no campo `codes`, sem os códigos internos), e os produtos só com código interno que têm foto com fundo transparente, nomeados pela descrição. As fotos já saem otimizadas, e o `relatorio.txt` do ZIP lista os produtos que ficaram de fora e o motivo. Veja o [`CONTRIBUTING.md`](./CONTRIBUTING.md#contribuindo-com-os-produtos-do-seu-mercado).
- As fotos enviadas no cadastro são reduzidas para no máximo 800 px e salvas em PNG no diretório de dados, como `photos/<código>.png` para um produto de um código e `photos/<id>.png` para um produto com vários; ao mudar os códigos, o app renomeia a foto. Por isso, o código só aceita letras sem acento, números, ponto, hífen e sublinhado. A rota `/fotos/<id>` serve a foto do produto, e `/catalogo/ean/<ean>` a imagem do catálogo antes de o produto ser salvo.
- Para mudar o schema, edite `schema.ts`, rode `pnpm db:generate --name <mudança>` e versione a pasta da migration gerada. Uma migration que já foi para a `main` nunca é editada: crie outra. Quando a mudança precisa levar os dados existentes, edite o `migration.sql` gerado antes do merge e teste a migration com dados no formato antigo (como em `src/infra/database/migrations.test.ts`).

### Estrutura do projeto

- `src/app` guarda apenas código exclusivo do frontend. As rotas ficam no route group `src/app/(pages)` (que não altera a URL), os componentes compartilhados em `src/app/components`, os hooks do React em `src/app/hooks` e os demais helpers em `src/app/helpers`. Não há barrels `index.ts`: cada módulo é importado direto do seu arquivo pelo alias `@/`.
- Os componentes são agrupados por papel: `ui/` para blocos visuais (os do shadcn em `ui/shadcn/`), `blocks/` para peças compostas reutilizadas entre páginas (agrupadas por domínio, ex.: `blocks/post/`), `providers/` para providers de contexto e `layouts/` para as estruturas de página, cujas partes privadas ficam numa pasta `_components/` ao lado.
- Os estilos globais ficam em `src/app/styles/globals.css`.
- O que não é exclusivo do frontend, como `src/tests`, fica direto em `src`, ao lado de `app`. Os tipos e as regras do domínio (pôster, layouts, modelos de arte, catálogo), usados pela interface e pelo servidor, ficam em `src/domain`.
- O catálogo comunitário fica em `catalog/`, na raiz: `catalog/ean/` com `<ean>.png` e `<ean>.json` e `catalog/no-ean/` com as imagens nomeadas pela descrição. As regras de nome, de JSON e de imagem estão no [`CONTRIBUTING.md`](./CONTRIBUTING.md) e são conferidas por `pnpm catalog:check`.

### Pôster em PNG

- O PNG é uma captura do componente do pôster feita pelo Chromium headless (`playwright-core`), então sai idêntico à pré-visualização. O `ImageResponse` (Satori) não é usado porque não suporta grid, variáveis CSS nem cores relativas.
- As fontes do pôster são servidas pela própria instância (`next/font`), então a geração funciona sem internet.
- O Chromium vem dentro da imagem Docker, que por isso tem cerca de 1,3 GB.

### Estilo e UI

- **Tailwind CSS v4** via `@tailwindcss/postcss`.
- **shadcn/ui** (estilo `base-nova`, cor base `neutral`, ícones `lucide`) sobre o [Base UI](https://base-ui.com), com `class-variance-authority` e o helper `cn()` do pacote `cn`. É a biblioteca de componentes do projeto: procure um componente do shadcn antes de escrever um do zero. Os componentes ficam em `src/app/components/ui/shadcn/`; adicione outros com `pnpm shadcn:add <name>`.
- **Cores padrão como vêm:** os tokens do shadcn e a paleta do Tailwind não são alterados. Use os tokens (`bg-background`, `text-muted-foreground`, ...) para superfícies e textos, e escolha uma cor existente da paleta (ex.: `teal-500`) em vez de um tom personalizado.
- **Modo escuro** segue a preferência do sistema (`prefers-color-scheme`).
- Links com aparência de botão continuam sendo elementos `<a>`/`Link` estilizados com `buttonVariants(...)`, nunca renderizados pelo `Button`.

### Lint e formatação

- **ESLint** (flat config) estende o `eslint-config-next` e adiciona os plugins `unicorn`, `simple-import-sort`, `tailwindcss`, `promise` e `prefer-arrow-functions`, além do `@eslint/json` e do `@eslint/markdown`.
- **Prettier** com aspas simples, sem ponto e vírgula e sem vírgula final. Indentação e espaços em branco são definidos pelo `.editorconfig`.
- Scripts: `pnpm eslint:check`, `pnpm eslint:fix`, `pnpm prettier:check`, `pnpm prettier:fix` e `pnpm type-check`.

### Comentários no código

- Comentários registram apenas o porquê de uma decisão, de preferência com uma referência (documentação, issue ou bug upstream), nunca o que o código faz. São escritos em inglês.

### Testes

- **Testes unitários:** Vitest com `jsdom` e Testing Library. Rode `pnpm test` (uma vez) ou `pnpm test:watch`. Só arquivos `src/**/*.test.{ts,tsx}` são considerados.
- **Testes E2E:** Playwright (Chromium) em `src/tests/e2e`. Rode `pnpm test:e2e` ou `pnpm test:e2e:ui`. Os testes sobem um servidor de desenvolvimento próprio na porta 3100, com os dados em `.next/e2e/data`, então nunca alteram os dados de `data/` e podem rodar com o `pnpm dev` aberto. O projeto `setup` (`*.setup.ts`) configura a marca antes dos demais testes.
- Testamos apenas a lógica que escrevemos, não o comportamento de bibliotecas ou do framework.

### Git hooks e CI

- **Hooks do Husky:**
  - `pre-commit` roda o `lint-staged` (Prettier, ESLint e `vitest related` nos arquivos em stage, e a otimização das imagens do catálogo).
  - `commit-msg` adiciona o emoji do prefixo e roda o `commitlint`.
  - `pre-push` roda `pnpm type-check` e `pnpm test:e2e`.
- **Mensagens de commit** são escritas em inglês, no imperativo e em minúsculas, com um prefixo semântico, por exemplo `✨ feat: add product page`. Basta digitar `feat: ...`, pois o hook adiciona o emoji.
- **Branches:** o trabalho de cada issue vai numa branch nova chamada `<scope>/<title>#<issue>`, em que `<scope>` é o prefixo do commit sem o emoji, por exemplo `feat/home-page#3`. Para um trabalho bem específico, acrescente um alvo opcional entre parênteses (uma página, componente ou outra área), por exemplo `fix(card)/focus-ring#7`. Nada de uma issue é commitado direto na `main`.
- **Issues** são criadas a partir do template **Tarefa** (`.github/ISSUE_TEMPLATE/task.md`). Marque todos os itens concluídos da lista no corpo da issue antes de fechá-la.
- **GitHub Actions** (`.github/workflows/ci.yml`) roda em todo pull request: commitlint, type-check, ESLint, Prettier, testes unitários, validação do catálogo e testes E2E.
- **Versões:** a imagem Docker é publicada pelo workflow `.github/workflows/release.yml` quando uma tag `vX.Y.Z` é criada, com as tags `X.Y.Z`, `X.Y` e `latest`. Antes de publicar, o workflow sobe o container de cada arquitetura e gera um PNG do pôster. Depois de publicar a imagem, ele cria o release da versão no GitHub, com o comando para baixar a imagem, os links para os guias e a lista dos pull requests da versão. Em pull requests que mudam o `Dockerfile`, o `.dockerignore`, o `pnpm-lock.yaml` ou o próprio workflow, ele roda só o build e esse teste, sem publicar.

### Criando uma versão

1. Numa branch, atualize a versão do `package.json` com `pnpm version --no-git-tag-version X.Y.Z` e abra o pull request. A tag precisa ter a mesma versão do `package.json`, senão o workflow falha.
2. Depois do merge, crie a tag na `main` e envie:

   ```bash
   git switch main && git pull
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

3. Acompanhe o workflow `release` no GitHub Actions. No fim, o release da versão aparece em [Releases](https://github.com/supermercado-baratao/sb-instagram/releases), sem passo manual. A versão segue o [Semantic Versioning](https://semver.org/lang/pt-BR/): `X` para mudanças incompatíveis, `Y` para funcionalidades novas e `Z` para correções.

### Configuração do assistente de IA

- O `AGENTS.md` (importado pelo `CLAUDE.md`) documenta as convenções do projeto para agentes de código.
- O `.mcp.json` configura os servidores MCP `context7` (documentação de bibliotecas) e `playwright`.
- A pasta `.claude/` contém a skill `new-component`, para adicionar componentes do shadcn ou compartilhados, o subagente `ui-reviewer`, que revisa semântica e acessibilidade da UI, e um `settings.json` que pede confirmação antes de cada `git commit`.

#### Chave de API do Context7

O `.mcp.json` lê a chave da variável de ambiente `CONTEXT7_API_KEY` (`"Authorization": "Bearer ${CONTEXT7_API_KEY}"`), para que ela nunca vá parar no repositório. O Claude Code expande a variável ao iniciar.

1. Gere uma chave de API no painel do [Context7](https://context7.com).
2. Defina a variável de uma destas formas:
   - **Shell (todos os projetos):** exporte-a no perfil do seu shell. No fish, rode `set -Ux CONTEXT7_API_KEY <sua-chave>`. No bash ou zsh, adicione `export CONTEXT7_API_KEY=<sua-chave>` ao `~/.bashrc` ou `~/.zshrc`.
   - **Só este projeto:** adicione-a ao `.claude/settings.local.json`, que é ignorado pelo git:

     ```json
     {
       "env": {
         "CONTEXT7_API_KEY": "<sua-chave>"
       }
     }
     ```

3. Reinicie o Claude Code e rode `/mcp` para conferir se o `context7` está conectado.

Nunca coloque a chave no `.mcp.json` nem no `.claude/settings.json`, pois os dois são commitados.

## Licença

[MIT](./LICENSE)
