# Golfpott

En webbapp för att hantera prispengar efter en golfrunda. Byggd med ren HTML, CSS och JavaScript — ingen server, ingen databas, ingen inloggning.

## Kom igång lokalt

```bash
npm install
npm run dev
```

## Bygg för produktion

```bash
npm run build
```

Filerna hamnar i `dist/`-mappen.

## Publicera på GitHub Pages

Appen publiceras automatiskt via GitHub Actions. Så här gör du:

### 1. Skapa ett repo på GitHub

Skapa ett nytt repo med namnet **golfpott** (exakt det namnet — det styr webbadressen).

### 2. Ladda upp filerna

Ladda upp alla filer och mappar till repot. De filer som ska med är:

```
.github/
  workflows/
    deploy.yml
public/
  favicon.svg
  vite.svg
app.js
index.html
style.css
vite.config.ts
package.json
package-lock.json
README.md
.gitignore
```

**Viktigt:** `.env` och `.bolt/` ska **inte** laddas upp. De finns med i `.gitignore` och innehåller nycklar som inte ska vara offentliga.

### 3. Aktivera GitHub Pages

1. Gå till repot på GitHub → **Settings** → **Pages**.
2. Under **Source**, välj **GitHub Actions** (inte "Deploy from a branch").
3. Klart! Nästa gång du pushar kod till `main`-branchen byggs och publiceras appen automatiskt.

Appen blir tillgänglig på: `https://<ditt-användarnamn>.github.io/golfpott/`

## Funktioner

- Lägg till, redigera och ta bort spelare med namn, exakt handicap, poäng och kategori (dam/herr)
- Autosort sorterar efter flest poäng, vid lika rankas lägre handicap högre
- Prispott beräknas automatiskt från insats och antal spelare
- Välj mellan procentuella prismallar och fasta eurobelopp
- Skapa egna mallar och anpassa antal pristagare
- Dampris kan aktiveras separat med egna regler
- Exportera resultat som CSV eller text
- Allt sparas automatiskt lokalt i webbläsaren
- Mobilanpassad design som fungerar på iPhone, iPad och dator
