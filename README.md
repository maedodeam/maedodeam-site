# maedodeam-site

Site institucional da **MAEDODEAM CONSULTORIA EM TECNOLOGIA DA INFORMACAO LTDA**, publicado pelo
GitHub Pages em `https://maedodeam.com.br`.

Site 100% estático: HTML e CSS, sem JavaScript, sem fontes externas, sem build.

```
maedodeam-site/
├── index.html     página inicial (apresentação, jogos, contato)
├── privacy.html   política de privacidade dos produtos
├── support.html   suporte
├── 404.html       página de erro do GitHub Pages
├── style.css      estilo único (claro/escuro automático)
├── CNAME          domínio próprio: maedodeam.com.br
├── .nojekyll      diz ao GitHub Pages para publicar os arquivos como estão (sem Jekyll)
└── README.md
```

E-mail institucional, de suporte e de privacidade (em `index.html`, `support.html` e `privacy.html`): `maedodeam@gmail.com`.

## Política de privacidade do Escritório 17h58

URL oficial: `https://maedodeam.com.br/privacy.html`. A seção `#escritorio-17h58` tem a política em 7 idiomas, um
`<article>` por idioma, sem JavaScript. O jogo abre a página com o idioma no endereço (`privacy.html#pt-BR`, `#en`, `#es`,
`#fr`, `#ja`, `#ko`, `#zh-CN`; `PrivacyConfig` no repositório do jogo), e o navegador desce até o bloco daquele idioma.

Ao mudar a política:

1. Mude o texto em português (`<article id="pt-BR">`), que é a versão de referência.
2. Mude as outras seis com o mesmo sentido (tradução fiel, sem adaptação).
3. Atualize a data "Última atualização" nos 7 blocos: é a data em que a versão nova é publicada.
4. Confira se o texto continua de acordo com o jogo e com `docs/PRIVACIDADE.md`, no repositório do jogo.

Para ver o site localmente, basta abrir `index.html` no navegador.
(A `404.html` usa caminhos absolutos e só aparece certa no GitHub Pages.)

## Adicionar outro jogo ou produto

- `index.html`: copie o bloco `<li class="product">` do Escritório 17h58 dentro de `<ul class="products">`.
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
