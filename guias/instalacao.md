# Instalação

Este guia instala o SB Instagram num computador do mercado, que passa a servir o app para as outras máquinas da rede. Não é preciso saber programar: basta seguir os passos e copiar os comandos.

## O que você precisa

- Um computador que fique ligado enquanto o app for usado, com Windows 10 ou 11 (64 bits) ou Linux, pelo menos 4 GB de memória e 5 GB livres em disco.
- Internet para a instalação e as atualizações. Depois de instalado, o app funciona só com a rede do mercado.
- As outras máquinas que vão usar o app na mesma rede (cabo ou Wi-Fi) desse computador.

## 1. Instale o Docker

O app roda dentro do Docker, que cuida de tudo o que ele precisa para funcionar.

### Windows

1. Baixe e instale o [Docker Desktop para Windows](https://docs.docker.com/desktop/setup/install/windows-install/). Se o instalador perguntar, mantenha a opção **WSL 2** marcada.
2. Reinicie o computador se for pedido e abra o Docker Desktop. Aceite os termos e pule o login: não é preciso ter conta.
3. Em **Settings** > **General**, marque **Start Docker Desktop when you sign in to your computer**. Assim o app volta sozinho quando o computador for ligado e alguém entrar no Windows.

O Docker Desktop é gratuito para empresas com menos de 250 funcionários e menos de 10 milhões de dólares de faturamento anual. Acima disso, ele exige uma assinatura paga ([termos](https://docs.docker.com/subscription/desktop-license/)).

Os comandos dos próximos passos são digitados no **PowerShell** (procure por "PowerShell" no menu Iniciar).

### Linux

Instale o Docker Engine seguindo o [guia oficial da sua distribuição](https://docs.docker.com/engine/install/). Ele já inclui o `docker compose` e volta sozinho quando o computador é ligado.

Os comandos dos próximos passos são digitados no terminal. Se o seu usuário não estiver no grupo `docker`, coloque `sudo` antes de cada comando `docker`.

## 2. Baixe o arquivo de configuração

Crie uma pasta chamada `sb-instagram` e baixe para dentro dela o arquivo `compose.yaml`, que diz ao Docker qual imagem usar e onde guardar os dados.

No Windows (PowerShell):

```powershell
mkdir sb-instagram
cd sb-instagram
curl.exe -fsSLO https://raw.githubusercontent.com/supermercado-baratao/sb-instagram/main/compose.yaml
```

No Linux:

```bash
mkdir sb-instagram
cd sb-instagram
curl -fsSLO https://raw.githubusercontent.com/supermercado-baratao/sb-instagram/main/compose.yaml
```

> [!IMPORTANT]
> Rode todos os comandos do Docker de dentro dessa pasta e não mude o nome dela. O Docker guarda os dados do mercado num volume com o nome da pasta (`sb-instagram_data`): numa pasta com outro nome, o app abre vazio, como se fosse a primeira vez.

## 3. Inicie o app

Dentro da pasta `sb-instagram`:

```bash
docker compose up -d
```

Na primeira vez, o Docker baixa a imagem do app (cerca de 1,3 GB), o que pode levar alguns minutos. Depois, o app fica rodando em segundo plano e volta sozinho quando o computador é reiniciado.

Abra [http://localhost:3000](http://localhost:3000) no navegador desse computador. No primeiro acesso, o app pede a marca do mercado (nome, logo, slogan, @ do Instagram e as cores dos modelos de arte). Depois de salvar, as ofertas e os produtos ficam liberados.

Para parar o app, use `docker compose stop`. Para iniciá-lo de novo, `docker compose up -d`.

## 4. Abra o app nas outras máquinas

As outras máquinas acessam o app pelo endereço IP do computador onde ele foi instalado.

1. Descubra o IP desse computador:
   - **Windows:** rode `ipconfig` no PowerShell e procure o **Endereço IPv4** da rede em uso, por exemplo `192.168.0.10`.
   - **Linux:** rode `hostname -I` no terminal. O primeiro número é o IP, por exemplo `192.168.0.10`.
2. Na outra máquina, abra `http://192.168.0.10:3000` no navegador, trocando pelo IP que você encontrou.
3. Salve o endereço nos favoritos de cada máquina.

Se a página não abrir:

- Confira se as duas máquinas estão na mesma rede e se o app abre em `http://localhost:3000` no computador onde ele roda.
- **Windows:** se o Windows perguntar se o Docker Desktop pode se comunicar pela rede, permita em **redes privadas**. Se a pergunta não aparecer, crie uma regra no **Windows Defender Firewall** liberando a entrada na porta TCP 3000, ou peça a quem cuida da rede do mercado.
- **Linux:** se houver um firewall ativo, libere a entrada na porta TCP 3000.

O IP pode mudar quando o roteador reinicia. Para o endereço não mudar, peça a quem cuida da rede para reservar um IP fixo para esse computador no roteador.

> [!WARNING]
> O app não tem login: qualquer pessoa que acesse o endereço pode usá-lo. Nunca libere a porta 3000 para a internet no roteador; deixe o acesso só para a rede do mercado.

## Usar outra porta

Se a porta 3000 já estiver em uso no computador, troque o primeiro número da linha `ports` no `compose.yaml`. Para usar a porta 8080, por exemplo:

```yaml
ports:
  - '8080:3000'
```

Depois, rode `docker compose up -d` de novo e acesse o app pela nova porta (`http://localhost:8080`).

## Próximos passos

- [Atualização](./atualizacao.md): como instalar uma versão nova.
- [Backup e restauração](./backup.md): como guardar uma cópia dos dados do mercado.
