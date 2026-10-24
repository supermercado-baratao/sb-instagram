# Backup e restauração

Tudo o que o mercado cadastra no app fica no volume de dados do Docker: o banco (produtos, ofertas, marca e modelos de arte), as fotos dos produtos e o logo. O backup é uma cópia desse volume num único arquivo, `sb-instagram-backup.tar.gz`.

Faça um backup antes de cada [atualização](./atualizacao.md) e, de tempos em tempos, guarde uma cópia fora do computador do app (num pendrive, num HD externo ou na nuvem). Se esse computador quebrar, é essa cópia que salva os dados do mercado.

Os comandos abaixo são os mesmos no Windows (PowerShell) e no Linux, e são rodados na pasta `sb-instagram` da [instalação](./instalacao.md).

## Fazendo o backup

O app fica fora do ar durante o backup, que costuma levar poucos segundos. Pare o app antes de copiar: com ele rodando, o banco pode ser copiado no meio de uma gravação e o backup sai com defeito.

```bash
docker compose stop
docker compose run --rm --no-deps --user root -v "${PWD}:/backup" app tar -czf /backup/sb-instagram-backup.tar.gz -C /data .
docker compose up -d
```

O arquivo `sb-instagram-backup.tar.gz` aparece na pasta `sb-instagram`. Um novo backup substitui o anterior, então renomeie o arquivo com a data (por exemplo, `sb-instagram-backup-2026-10-23.tar.gz`) se quiser manter mais de uma cópia.

## Restaurando

A restauração **apaga todos os dados atuais do app** e coloca no lugar os do backup. Tudo o que foi salvo depois do backup se perde.

1. Coloque o arquivo do backup na pasta `sb-instagram`, com o nome `sb-instagram-backup.tar.gz`.
2. Rode:

   ```bash
   docker compose stop
   docker compose run --rm --no-deps --user root -v "${PWD}:/backup" app sh -c "find /data -mindepth 1 -delete && tar -xzf /backup/sb-instagram-backup.tar.gz -C /data"
   docker compose up -d
   ```

3. Abra o app no navegador e confira se as ofertas, os produtos e a marca voltaram.

### Num computador novo

Para levar o app para outro computador, ou reinstalá-lo depois de uma pane:

1. Siga a [instalação](./instalacao.md) até o passo 2 (baixar o `compose.yaml`), sem iniciar o app.
2. Copie o arquivo do backup para a pasta `sb-instagram` e siga os passos de [restauração](#restaurando).

Se o backup veio de uma versão mais nova que a do `compose.yaml`, ajuste a tag da imagem antes de restaurar (veja [Escolhendo a versão](./atualizacao.md#escolhendo-a-versão)).
