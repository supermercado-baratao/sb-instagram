# Como contribuir

Obrigado pelo interesse em ajudar! A forma mais simples de contribuir é com o **catálogo comunitário**: fotos e dados de produtos que qualquer mercado pode usar. Quando um mercado bipa um produto que está no catálogo, o app já preenche descrição, unidade e foto.

Para contribuir com código, veja o fluxo completo em [`docs/development-workflow.md`](./docs/development-workflow.md) e as convenções no [`AGENTS.md`](./AGENTS.md).

## Estrutura do catálogo

O catálogo fica na pasta `catalog/`, dividida em duas:

```text
catalog/
├── ean/                       produtos com código de barras
│   ├── 7891000100103.png
│   └── 7891000100103.json
└── no-ean/                    produtos sem código de barras
    └── picanha-bovina.png
```

## Produtos com EAN

São os produtos com código de barras, que é o mesmo em qualquer mercado. Cada produto tem **dois arquivos** em `catalog/ean/`, os dois com o EAN como nome:

- `<ean>.png`: a foto do produto, seguindo as [regras de imagem](#regras-de-imagem);
- `<ean>.json`: os dados do produto.

O EAN é o número impresso embaixo do código de barras, só com os dígitos. São aceitos códigos de 8 dígitos (EAN-8), 13 dígitos (EAN-13) e 12 dígitos (UPC-A, comum em importados). O último dígito é o verificador, então um número digitado errado é recusado pela validação.

O JSON tem exatamente dois campos, os dois texto e nenhum vazio:

```json
{
  "description": "Leite Integral Marca",
  "unit": "1 L"
}
```

| Campo         | O que é                                                            | Exemplos                                         |
| ------------- | ------------------------------------------------------------------ | ------------------------------------------------ |
| `description` | Nome do produto com a marca, como aparece no pôster, sem a unidade | `Leite Integral Nestlé`, `Arroz Tipo 1 Tio João` |
| `unit`        | Quantidade e unidade da embalagem                                  | `1 L`, `5 kg`, `500 g`, `12 un`                  |

Os dois arquivos andam juntos: uma foto sem JSON (ou um JSON sem foto) é recusada.

### Variações com uma foto só

Quando uma foto mostra variações vendidas com códigos de barras diferentes (as fragrâncias de um sabonete, por exemplo), os arquivos levam um dos EANs como nome e o JSON lista os outros no campo opcional `codes`:

```json
{
  "description": "Sabonete Marca",
  "unit": "85 g",
  "codes": ["7891000100110", "7891000100127"]
}
```

Bipar qualquer um desses EANs encontra o produto. Cada EAN de `codes` precisa ser válido e aparecer uma vez só no catálogo inteiro: não pode ser o nome de outro arquivo nem estar no `codes` de outro produto. Códigos internos nunca entram em `codes`, porque mudam de mercado para mercado.

## Produtos sem EAN

Carnes, hortifrúti, padaria e outros produtos vendidos sem código de barras usam um código interno, que muda de mercado para mercado. Por isso, só a foto vai para o catálogo, em `catalog/no-ean/`, e cada mercado associa a foto ao próprio código (veja o [README](./README.md#usando-uma-imagem-sem-ean)).

O nome do arquivo é a descrição do produto em letras minúsculas, sem acentos e com hífens no lugar dos espaços, por exemplo `picanha-bovina.png`, `pao-frances.png` ou `banana-prata.png`. Não use o código interno do seu mercado como nome. Se a foto não mostra embalagem nem marca, como a de um produto vendido a granel, deixe a marca fora do nome (`linguica-suina.png`, não `linguica-suina-aurora.png`), para que outros mercados a encontrem e usem com a marca que vendem.

## Imagens repetidas

Antes de enviar, confira se a mesma foto não aparece em mais de um arquivo, entre os que você está enviando ou nos que o catálogo já tem. Cada foto entra no catálogo uma vez só:

- **Mesmo produto com EANs diferentes** (as fragrâncias de um sabão em pó numa foto só, por exemplo): é um produto só, com os outros EANs em `codes` (veja [Variações com uma foto só](#variações-com-uma-foto-só)). Não envie um arquivo por EAN com a mesma foto. Se um desses EANs já está no catálogo, acrescente os outros ao `codes` do arquivo que já existe.
- **Produtos sem EAN de marcas diferentes com a mesma foto** (linguiças a granel, por exemplo): envie uma imagem só, com um nome genérico, sem a marca, e apague as cópias.

## Regras de imagem

- **Formato:** PNG (`.png`).
- **Dimensões:** quadrada, com o lado entre 600 e 800 px. No pôster, a foto aparece com no máximo uns 340 px, então 800 px já dá o dobro de folga, e uma imagem maior só deixaria o arquivo mais pesado.
- **Tamanho:** até 1 MB, em PNG sem perda, para que o texto da embalagem continue legível.
- **Fundo:** transparente. O card do pôster tem fundo colorido, então um fundo branco ficaria aparecendo em volta do produto. A validação confere os quatro cantos da imagem, que precisam estar totalmente transparentes.
- **Conteúdo:** só o produto, centralizado, sem textos, preços, marcas d'água ou outros objetos.
- **Direitos:** envie apenas fotos que você mesmo fez ou que tenham uma licença que permita o uso. Não copie fotos de sites de fabricantes ou de outros mercados.

Você não precisa ajustar o tamanho, as dimensões nem o enquadramento à mão: pode colocar a imagem grande, do jeito que ela saiu do editor, e o projeto a otimiza (veja abaixo). O que precisa vir pronto é o **fundo transparente**: recorte o produto num editor de imagem (como o GIMP) ou numa ferramenta de remoção de fundo e exporte em PNG.

## Otimizando as imagens

O comando abaixo prepara cada PNG do catálogo que ainda não segue as regras: corta a área transparente em volta do produto, reduz o lado maior para 800 px (imagens menores não são ampliadas), centraliza o produto num quadrado com uma pequena margem transparente e comprime o arquivo sem perda de qualidade.

```bash
pnpm catalog:optimize
```

O arquivo é **substituído** pela versão otimizada, então guarde o original em outro lugar se quiser mantê-lo. Uma imagem com fundo não é otimizada: o comando avisa e deixa o arquivo como está.

Se você fizer o commit pelo seu computador, nem precisa rodar o comando: o hook de `pre-commit` otimiza os PNGs do catálogo que estiverem no commit e só deixa o commit seguir se o resultado passar nas regras.

## Contribuindo com os produtos do seu mercado

Se o seu mercado usa o app, os produtos que vocês já cadastraram e fotografaram podem ir para o catálogo sem copiar arquivo por arquivo e sem instalar nada:

1. Em **Produtos** (`/produtos`), cada produto da loja mostra a situação dele no catálogo: "No catálogo", "Pronto para o catálogo", "Exportado para o catálogo" (enviado, esperando entrar numa versão nova do app) ou o que falta para entrar (sem foto, sem unidade, foto com fundo ou foto pequena demais). O filtro **Enviar ao catálogo** mostra só os que ainda dependem do mercado: os que têm pendência e os prontos que ainda não foram exportados. Corrija no app o que quiser incluir. Se o mesmo produto foi cadastrado mais de uma vez, um cadastro para cada EAN com a mesma foto, junte os cadastros com **Mesclar** antes de exportar.
2. Clique em **Exportar para o catálogo**. O app baixa o `catalogo.zip`, com as pastas `ean/` e `no-ean/` já no formato do catálogo e com as fotos otimizadas. Entram só os produtos novos ou alterados desde a última exportação; **Exportar todos de novo** inclui também os já exportados, caso o ZIP anterior tenha se perdido.
3. O `relatorio.txt` do ZIP lista os produtos que ficaram de fora e o motivo: os que têm pendências, os já exportados sem mudanças e os que já estão no catálogo.
4. Confira as descrições e as unidades nos arquivos `.json`, veja se cada foto segue as [regras de imagem](#regras-de-imagem), principalmente a de direitos, e procure [imagens repetidas](#imagens-repetidas). O app não junta fotos iguais: produtos sem EAN que usam a mesma foto saem com uma imagem cada, com o nome da descrição de cada um.

   Um produto com vários EANs sai com um deles como nome e os outros em `codes`. Os códigos internos dele ficam de fora.

5. Envie os arquivos pelo [site do GitHub](#enviando-pelo-site-do-github), sem git, ou descompacte o ZIP dentro da pasta `catalog/` do seu fork, sem o `relatorio.txt`, e siga [Validando e enviando](#validando-e-enviando).

## Enviando pelo site do GitHub

Não precisa instalar nada nem saber git: basta uma conta no GitHub. As fotos do `catalogo.zip` já saem otimizadas, então podem ser enviadas como estão.

1. Descompacte o `catalogo.zip` no seu computador.
2. Abra a pasta [`catalog/ean`](https://github.com/supermercado-baratao/sb-instagram/tree/main/catalog/ean) do repositório, clique em **Add file → Upload files** e arraste todos os arquivos da pasta `ean/` do ZIP (as imagens e os `.json`). O GitHub cria uma cópia do repositório na sua conta (um fork) se precisar.
3. Embaixo, em **Commit changes**, escreva uma frase sobre o envio (ex.: `Produtos do Mercado Exemplo`), escolha **Create a new branch** e clique em **Propose changes**. Na página seguinte, clique em **Create pull request**.
4. Faça o mesmo com a pasta `no-ean/` do ZIP, em [`catalog/no-ean`](https://github.com/supermercado-baratao/sb-instagram/tree/main/catalog/no-ean). Se preferir, envie no mesmo pull request: abra a branch criada no passo 3 antes de clicar em **Add file**.

O GitHub aceita até 100 arquivos por envio. Como cada produto com EAN tem dois arquivos, envie em partes quando passar de 50 produtos. O CI valida os arquivos no pull request, e o pull request só pode ser aceito com a validação passando.

## Validando e enviando

1. Faça um fork do repositório e adicione os arquivos na pasta certa.
2. Instale as dependências (`pnpm install`), otimize as imagens (`pnpm catalog:optimize`) e rode a validação:

   ```bash
   pnpm catalog:check
   ```

   O comando lista cada arquivo com problema e o motivo. Corrija até aparecer `Catálogo válido`.

3. Abra um pull request. O CI roda a mesma validação, e o pull request só pode ser aceito com ela passando. Se você enviar pelo site do GitHub imagens que não vieram do app, o hook não roda: otimize as imagens antes, no seu computador.
