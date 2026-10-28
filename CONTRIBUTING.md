# Como contribuir

Obrigado pelo interesse em ajudar! A forma mais simples de contribuir é com o **catálogo comunitário**: fotos e dados de produtos que qualquer mercado pode usar. Quando um mercado bipa um produto que está no catálogo, o app já preenche nome, marca, unidade e foto.

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

O JSON tem exatamente três campos, todos texto e nenhum vazio:

```json
{
  "name": "Leite Integral",
  "brand": "Marca",
  "unit": "1 L"
}
```

| Campo   | O que é                                      | Exemplos                         |
| ------- | -------------------------------------------- | -------------------------------- |
| `name`  | Nome do produto, sem a marca e sem a unidade | `Leite Integral`, `Arroz Tipo 1` |
| `brand` | Marca, como aparece na embalagem             | `Tio João`, `Nestlé`             |
| `unit`  | Quantidade e unidade da embalagem            | `1 L`, `5 kg`, `500 g`, `12 un`  |

Os dois arquivos andam juntos: uma foto sem JSON (ou um JSON sem foto) é recusada.

### Variações com uma foto só

Quando uma foto mostra variações vendidas com códigos de barras diferentes (as fragrâncias de um sabonete, por exemplo), os arquivos levam um dos EANs como nome e o JSON lista os outros no campo opcional `codes`:

```json
{
  "name": "Sabonete",
  "brand": "Marca",
  "unit": "85 g",
  "codes": ["7891000100110", "7891000100127"]
}
```

Bipar qualquer um desses EANs encontra o produto. Cada EAN de `codes` precisa ser válido e aparecer uma vez só no catálogo inteiro: não pode ser o nome de outro arquivo nem estar no `codes` de outro produto. Códigos internos nunca entram em `codes`, porque mudam de mercado para mercado.

## Produtos sem EAN

Carnes, hortifrúti, padaria e outros produtos vendidos sem código de barras usam um código interno, que muda de mercado para mercado. Por isso, só a foto vai para o catálogo, em `catalog/no-ean/`, e cada mercado associa a foto ao próprio código (veja o [README](./README.md#usando-uma-imagem-sem-ean)).

O nome do arquivo é a descrição do produto em letras minúsculas, sem acentos e com hífens no lugar dos espaços, por exemplo `picanha-bovina.png`, `pao-frances.png` ou `banana-prata.png`. Não use o código interno do seu mercado como nome.

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

Se o seu mercado usa o app, os produtos que vocês já cadastraram e fotografaram podem ir para o catálogo sem copiar arquivo por arquivo:

1. Em **Produtos** (`/produtos`), clique em **Exportar para o catálogo**. O app baixa o `catalogo.zip`, com as pastas `ean/` e `no-ean/` já no formato do catálogo e com as fotos otimizadas.
2. Abra o `relatorio.txt` do ZIP: ele lista os produtos que ficaram de fora e o motivo (sem foto, sem marca ou unidade, foto com fundo, foto pequena demais ou EAN que já está no catálogo). Corrija no app o que quiser incluir e exporte de novo.
3. Confira os nomes, as marcas e as unidades nos arquivos `.json` e veja se cada foto segue as [regras de imagem](#regras-de-imagem), principalmente a de direitos.

   Um produto com vários EANs sai com um deles como nome e os outros em `codes`. Os códigos internos dele ficam de fora.

4. Descompacte o ZIP dentro da pasta `catalog/` do seu fork, sem o `relatorio.txt`, e siga os passos abaixo. No commit, o hook de `pre-commit` otimiza e valida as imagens.

## Validando e enviando

1. Faça um fork do repositório e adicione os arquivos na pasta certa.
2. Instale as dependências (`pnpm install`), otimize as imagens (`pnpm catalog:optimize`) e rode a validação:

   ```bash
   pnpm catalog:check
   ```

   O comando lista cada arquivo com problema e o motivo. Corrija até aparecer `Catálogo válido`.

3. Abra um pull request. O CI roda a mesma validação, e o pull request só pode ser aceito com ela passando. Se você enviar os arquivos pelo site do GitHub, o hook não roda: otimize as imagens antes, no seu computador.
