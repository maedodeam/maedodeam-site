# maedodeam-site

Site institucional da **MAEDODEAM CONSULTORIA EM TECNOLOGIA DA INFORMACAO LTDA**, publicado pelo
GitHub Pages em `https://maedodeam.com.br`.

Site estático: HTML, CSS e um JavaScript pequeno (opcional — sem ele, tudo funciona, só sem animações).
Sem framework, sem cookies, sem analytics e sem fontes ou scripts de terceiros. Os HTML publicados são
**gerados** a partir de `src/` por um script Python sem dependências, e o resultado fica no repositório:
o GitHub Pages continua servindo a raiz da branch `main`, sem etapa de build.

```
maedodeam-site/
├── index.html             página inicial em inglês (idioma principal)       ← gerado
├── pt-br/index.html       página inicial em português do Brasil             ← gerado
├── support.html           suporte (EN) · pt-br/support.html (PT-BR)         ← gerado
├── 404.html               página de erro do GitHub Pages (EN + PT)          ← gerado
├── privacy.html           política de privacidade (texto à mão; cabeçalho e rodapé gerados)
├── sitemap.xml, robots.txt                                                  ← gerado
├── assets/
│   ├── site.css           estilo único (tema escuro, mobile first)
│   ├── site.js            animações, menu ativo, copiar e-mail
│   ├── fonts/             Archivo e JetBrains Mono (variáveis, subconjunto latino, licença OFL)
│   ├── img/               capturas do jogo em AVIF e WebP, 4 larguras, HUD em EN e PT-BR
│   └── og-en.jpg, og-pt-br.jpg   imagens de compartilhamento (Open Graph)
├── favicon.svg, favicon.ico, apple-touch-icon.png
├── src/
│   ├── build.py           gera as páginas
│   ├── i18n/en.json       textos em inglês
│   ├── i18n/pt-BR.json    textos em português
│   ├── templates/         index, support, 404
│   └── partials/          head, header, footer (também usados na privacy.html)
├── tools/assets.py        gera imagens, OG e ícones (só quando uma imagem muda)
├── CNAME                  domínio próprio: maedodeam.com.br
└── .nojekyll              o GitHub Pages publica os arquivos como estão
```

E-mail institucional, de suporte e de privacidade: `maedodeam@gmail.com`.

## Mudar o site

1. Mude o texto em `src/i18n/en.json` **e** em `src/i18n/pt-BR.json` (o inglês é o idioma principal; o
   português não é tradução literal — escreva as duas versões com naturalidade, com o mesmo sentido).
   Estrutura e layout ficam em `src/templates/` e `src/partials/`; estilo em `assets/site.css`.
2. Gere as páginas: `python src/build.py`
3. Veja localmente: `python -m http.server 8765` e abra `http://localhost:8765/` (e `/pt-br/`).
   (Abrir o arquivo direto no navegador não funciona bem: os links usam endereços de pasta, como `pt-br/`.)
4. Antes do commit, `python src/build.py --check` confirma que nada ficou sem gerar.

Nunca edite à mão os arquivos marcados como gerados acima: a próxima geração apaga a mudança. Na
`privacy.html`, só o que está entre `<!-- build:... -->` e `<!-- /build:... -->` é gerado.

Para mostrar o LinkedIn do fundador na seção "About", preencha `LINKEDIN` no início de `src/build.py`.

### Idiomas e SEO

- Inglês em `/`, português do Brasil em `/pt-br/`, com `lang`, `hreflang` (incluindo `x-default`),
  `canonical` e Open Graph localizados em cada página, e o `sitemap.xml` com as alternativas.
- O seletor EN / PT no topo leva à página equivalente no outro idioma. Não há redirecionamento automático.
- Os idiomas dos produtos (o jogo tem 7) são outra coisa: o site institucional é só EN e PT-BR.

### Imagens

As capturas são do próprio jogo (`TestResults/idiomas` no repositório `stealthgame`, geradas pelo jogo em
1920×1080, uma por idioma). Para trocar ou adicionar, ajuste `SHOTS` em `tools/assets.py` e rode
`python tools/assets.py` (precisa de `pip install pillow fonttools brotli`). O script também refaz as imagens
Open Graph e os ícones. Depois, `python src/build.py`.

## Política de privacidade do Escritório 17h58

URL oficial: `https://maedodeam.com.br/privacy.html`. **Não mude esse endereço nem os `id` dos blocos**: o jogo
abre a página com o idioma no endereço (`privacy.html#pt-BR`, `#en`, `#es`, `#fr`, `#ja`, `#ko`, `#zh-CN`;
`PrivacyConfig` no repositório do jogo), e o navegador desce até o bloco daquele idioma. A seção
`#escritorio-17h58` tem a política em 7 idiomas, um `<article>` por idioma, sem JavaScript.

Ao mudar a política:

1. Mude o texto em português (`<article id="pt-BR">`), que é a versão de referência.
2. Mude as outras seis com o mesmo sentido (tradução fiel, sem adaptação).
3. Atualize a data "Última atualização" nos 7 blocos: é a data em que a versão nova é publicada.
4. Confira se o texto continua de acordo com o jogo e com `docs/PRIVACIDADE.md`, no repositório do jogo.
5. Rode `python src/build.py` (atualiza só o cabeçalho e o rodapé; o texto da política não é tocado).

## Adicionar outro produto

- Página inicial: copie um `<article class="project">` em `src/templates/index.html`, com os textos novos
  nos dois JSON, e uma linha no quadro "Currently building" (`.board-row`).
- `privacy.html`: crie outra `<section id="...">` como a do Escritório 17h58, com a política do produto novo.

---

## Publicação

Os valores abaixo foram conferidos na documentação oficial do GitHub Pages em 2026-10-03.
Antes de configurar, confira de novo, porque o GitHub pode mudá-los:

- Domínio próprio: <https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site>
- Verificação do domínio: <https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/verifying-your-custom-domain-for-github-pages>
- HTTPS: <https://docs.github.com/en/pages/getting-started-with-github-pages/securing-your-github-pages-site-with-https>

Nos passos abaixo, `<DONO>` é a conta (ou organização) do GitHub dona do repositório.

### 1. Criar e publicar o repositório

No plano **GitHub Free**, o Pages só funciona em repositório **público** (no Pro funciona em privado,
mas o site continua público na internet). Este repositório não tem segredo nenhum.

Pelo site do GitHub: **New repository** → nome `maedodeam-site` → **Public** → sem README/licença
(já existem aqui) → **Create repository**. Depois, nesta pasta:

```bash
git add .
git commit -m "Site institucional da MAEDODEAM"
git remote add origin git@github.com:<DONO>/maedodeam-site.git
git push -u origin main
```

Ou, com o GitHub CLI (`gh`), num passo só:

```bash
gh repo create <DONO>/maedodeam-site --public --source . --push
```

### 2. Ativar o GitHub Pages

No repositório: **Settings** → **Pages** (seção "Code and automation" / "Code, planning, and automation").

### 3. Configurações em Settings > Pages

Em **Build and deployment**:

- **Source**: `Deploy from a branch`
- **Branch**: `main` e pasta `/ (root)` → **Save**

Em poucos minutos o site aparece em `https://<DONO>.github.io/maedodeam-site/`
(a aba **Actions** mostra o andamento da publicação).

### 4. Configurar `maedodeam.com.br` como Custom Domain

**Faça isto antes de mexer no DNS** (a documentação do GitHub pede essa ordem para evitar que
outra pessoa tome o domínio).

1. (Recomendado) Verifique o domínio na sua conta: foto do perfil → **Settings** → **Pages** →
   **Add a domain** → `maedodeam.com.br`. O GitHub mostra um registro **TXT** para criar no DNS
   (nome `_github-pages-challenge-<DONO>`, valor exibido na tela). Depois de criado, volte e clique
   em **Verify**. (Se o repositório for de uma organização, isso é feito nas configurações da organização.)
2. No repositório: **Settings** → **Pages** → **Custom domain** → `maedodeam.com.br` → **Save**.

O arquivo `CNAME` deste repositório já contém `maedodeam.com.br`, mas, segundo a documentação, o
arquivo sozinho não configura o domínio: o passo 2 acima é obrigatório.

### 5. Registros DNS no Registro.br

No painel do Registro.br, no domínio `maedodeam.com.br`, use os servidores DNS do próprio Registro.br
e abra a edição de zona (registros DNS). Crie:

| Tipo  | Nome                                | Valor                    |
|-------|-------------------------------------|--------------------------|
| A     | (vazio = `maedodeam.com.br`)        | `185.199.108.153`        |
| A     | (vazio)                             | `185.199.109.153`        |
| A     | (vazio)                             | `185.199.110.153`        |
| A     | (vazio)                             | `185.199.111.153`        |
| AAAA  | (vazio)                             | `2606:50c0:8000::153`    |
| AAAA  | (vazio)                             | `2606:50c0:8001::153`    |
| AAAA  | (vazio)                             | `2606:50c0:8002::153`    |
| AAAA  | (vazio)                             | `2606:50c0:8003::153`    |
| CNAME | `www`                               | `<DONO>.github.io`       |
| TXT   | `_github-pages-challenge-<DONO>`    | (valor mostrado pelo GitHub no passo 4.1) |

Cuidados (da documentação do GitHub):

- Apague qualquer outro registro A, AAAA, ALIAS ou ANAME no nome vazio (`@`) e qualquer outro registro
  do `www`; registros a mais podem impedir a emissão do certificado HTTPS.
- **Não** crie registro curinga (`*.maedodeam.com.br`): risco de tomada do domínio.
- Os AAAA (IPv6) são opcionais, mas recomendados.
- Com o `www` apontando para `<DONO>.github.io`, o GitHub redireciona `www.maedodeam.com.br` para
  `maedodeam.com.br` automaticamente.

A propagação do DNS pode levar de minutos a algumas horas.

Para conferir (Linux/macOS/WSL):

```bash
dig maedodeam.com.br +noall +answer -t A
```

No Windows (PowerShell):

```powershell
Resolve-DnsName maedodeam.com.br -Type A
```

A resposta deve listar exatamente os 4 IPs da tabela.

### 6. Verificar e ativar o HTTPS

O HTTPS do GitHub Pages é gratuito (certificado Let's Encrypt emitido automaticamente pelo GitHub).
Não compre certificado.

1. Depois que o DNS propagar, abra **Settings** → **Pages**. A verificação do DNS deve aparecer como
   bem-sucedida ("DNS check successful").
2. Marque **Enforce HTTPS**. A documentação diz que a opção pode levar **até 24 horas** para ficar disponível.
3. Abra `https://maedodeam.com.br` e confira o cadeado do navegador. Teste também
   `http://maedodeam.com.br` (deve redirecionar para `https://`) e `https://www.maedodeam.com.br`.
4. Se aparecer "Certificate not yet created" por muito tempo: em Custom domain, clique em **Remove**,
   digite o domínio de novo e **Save** (isso reinicia a emissão do certificado).
