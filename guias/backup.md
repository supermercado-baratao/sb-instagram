# Backup e restauração

Tudo o que o mercado cadastra no app fica no volume de dados do Docker: o banco (produtos, ofertas, marca, modelos e o comercial), as fotos dos produtos, o logo e as ofertas geradas (imagens e PDFs). O backup é uma cópia de tudo isso num único arquivo.

Faça um backup antes de cada [atualização](./atualizacao.md) e, de tempos em tempos, guarde uma cópia fora do computador do app (num pendrive, num HD externo ou na nuvem). Se esse computador quebrar, é essa cópia que salva os dados do mercado.

## Pelo app

### Fazendo o backup

1. Abra o app no navegador, clique em **Configurações**, no canto direito do menu, e depois na aba **Backup**.
2. Clique em **Baixar backup**. O navegador baixa o arquivo `sb-instagram-backup-<data>.zip`, por exemplo `sb-instagram-backup-2026-11-07.zip`.

O app continua funcionando enquanto o backup é baixado. Com um histórico grande, o arquivo pode ficar grande e levar alguns minutos.

### Restaurando

A restauração **apaga todos os dados atuais do app** e coloca no lugar os do backup. Tudo o que foi salvo depois do backup se perde.

1. Em **Configurações** → **Backup**, em **Restaurar backup**, escolha o arquivo `.zip` do backup.
2. Clique em **Restaurar backup**. O app lê o arquivo e mostra o que muda: a marca e quantos produtos, artes da oferta, ofertas no histórico e termos do dicionário existem agora e no backup.
3. Confira e clique em **Restaurar backup** de novo para confirmar, ou em **Cancelar** para deixar tudo como está.

Um backup feito numa versão mais antiga do app é atualizado na restauração. Um backup feito numa versão mais nova é recusado: [atualize o app](./atualizacao.md) antes de restaurá-lo.

### Num computador novo

Para levar o app para outro computador, ou reinstalá-lo depois de uma pane:

1. Siga a [instalação](./instalacao.md) até abrir o app no navegador.
2. Configure qualquer marca no primeiro acesso, só para liberar o app. Ela é substituída pela do backup.
3. Restaure o backup em **Configurações** → **Backup**, como explicado acima.

### Levando só uma oferta do histórico

Para levar uma única oferta gerada para outra instalação, sem substituir os dados dela, use a página **Histórico**:

1. Na oferta, clique em **Baixar tudo (ZIP)**. O navegador baixa o arquivo `oferta-<número>-completa.zip`, com as artes, o PDF, o JSON dos dados, o roteiro e a lista de produtos.
2. Na outra instalação, abra **Histórico** e clique em **Importar para o histórico**. Escolha o arquivo `.zip`.
3. O app mostra o número da oferta no arquivo, quando ela foi gerada, quantas artes tem, a validade e o número que ela vai receber. Clique em **Importar oferta** para confirmar.

A oferta importada sempre entra como uma nova, com o próximo número da instalação e a data em que foi gerada. O resto do histórico, a oferta atual e os produtos não mudam. Importar o mesmo arquivo duas vezes cria duas ofertas no histórico.

## Pelo terminal

Use este caminho quando o app não abre no navegador e antes de cada [atualização](./atualizacao.md), já que voltar para a versão anterior pode exigir restaurar com o app parado. Os comandos são os mesmos no Windows (PowerShell) e no Linux, e são rodados na pasta `sb-instagram` da [instalação](./instalacao.md). Um backup feito pelo terminal só é restaurado pelo terminal, e um feito pelo app só pelo app.

### Fazendo o backup pelo terminal

O app fica fora do ar durante o backup, que costuma levar poucos segundos. Pare o app antes de copiar: com ele rodando, o banco pode ser copiado no meio de uma gravação e o backup sai com defeito.

```bash
docker compose stop
docker compose run --rm --no-deps --user root -v "${PWD}:/backup" app tar -czf /backup/sb-instagram-backup.tar.gz -C /data .
docker compose up -d
```

O arquivo `sb-instagram-backup.tar.gz` aparece na pasta `sb-instagram`. Um novo backup substitui o anterior, então renomeie o arquivo com a data (por exemplo, `sb-instagram-backup-2026-10-23.tar.gz`) se quiser manter mais de uma cópia.

### Restaurando pelo terminal

1. Coloque o arquivo do backup na pasta `sb-instagram`, com o nome `sb-instagram-backup.tar.gz`.
2. Rode:

   ```bash
   docker compose stop
   docker compose run --rm --no-deps --user root -v "${PWD}:/backup" app sh -c "find /data -mindepth 1 -delete && tar -xzf /backup/sb-instagram-backup.tar.gz -C /data"
   docker compose up -d
   ```

3. Abra o app no navegador e confira se as ofertas, os produtos e a marca voltaram.

Para restaurar num computador novo, siga a [instalação](./instalacao.md) até o passo 2 (baixar o `compose.yaml`), sem iniciar o app, copie o arquivo do backup para a pasta `sb-instagram` e siga os passos acima. Se o backup veio de uma versão mais nova que a do `compose.yaml`, ajuste a tag da imagem antes de restaurar (veja [Escolhendo a versão](./atualizacao.md#escolhendo-a-versão)).
