# Atualização

As versões novas do app são publicadas como imagens Docker. Atualizar troca só o app: os produtos, as ofertas, as fotos e a marca ficam no volume de dados e continuam lá.

As novidades de cada versão ficam na página de [releases](https://github.com/supermercado-baratao/sb-instagram/releases) do projeto.

## Antes de atualizar

[Faça um backup](./backup.md). Ao iniciar, uma versão nova pode ajustar o banco de dados para o formato dela, e uma versão antiga não abre mais esse banco. O backup é o que permite voltar para a versão anterior se algo der errado.

## Atualizando

Na pasta `sb-instagram` (a mesma da [instalação](./instalacao.md)):

```bash
docker compose pull
docker compose up -d
```

O `pull` baixa a imagem nova e o `up -d` recria o app com ela. Ao iniciar, o app ajusta o banco sozinho, sem nenhum passo a mais. Abra o app no navegador e confira se as ofertas e os produtos estão lá.

Cada imagem ocupa cerca de 1,3 GB. Para apagar as imagens antigas, que não são mais usadas, rode:

```bash
docker image prune
```

## Escolhendo a versão

O `compose.yaml` usa a imagem `ghcr.io/supermercado-baratao/sb-instagram:latest`, que é sempre a versão mais recente. Para controlar quando o app muda de versão, troque o `latest` na linha `image` por uma destas opções:

| Tag               | Recebe                                                      |
| ----------------- | ----------------------------------------------------------- |
| `latest`          | Todas as versões novas                                      |
| `1.0` (exemplo)   | Só as correções da versão 1.0 (`1.0.1`, `1.0.2`...)         |
| `1.0.0` (exemplo) | Nada: o app fica nessa versão até você trocar a tag de novo |

Por exemplo, para ficar na versão 1.0 recebendo só as correções:

```yaml
image: ghcr.io/supermercado-baratao/sb-instagram:1.0
```

Depois de mudar a tag, rode `docker compose pull` e `docker compose up -d`.

## Voltando para a versão anterior

Se a versão nova der problema:

1. Troque a tag da linha `image` no `compose.yaml` pela versão que você usava antes, por exemplo `1.0.0`.
2. [Restaure o backup](./backup.md#restaurando) feito antes da atualização. Não pule este passo: a versão antiga pode não abrir o banco ajustado pela versão nova.

Os dados salvos depois do backup se perdem. Se o problema não for urgente, abra uma [issue](https://github.com/supermercado-baratao/sb-instagram/issues) contando o que aconteceu.
