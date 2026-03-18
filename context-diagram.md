# Kontextsicht — iSAQB CPSA-F Mock Exam

```mermaid
C4Context
    title Kontextsicht – iSAQB CPSA-F Mock Exam

    Person(user, "Prüfling", "Nutzt die Web-App, um eine iSAQB CPSA-F Probeprüfung abzulegen")
    Person(lecturer, "Dozent / Prüfer", "Erhält exportierte Ergebnisse inkl. Notizen zur Auswertung")

    System(app, "iSAQB Mock Exam", "React 19 SPA (Vite + TypeScript)<br/>Gehostet auf GitHub Pages")

    System_Ext(ghPages, "GitHub Pages", "Statisches Hosting der gebauten SPA")
    System_Ext(ghActions, "GitHub Actions", "CI/CD Pipeline + Nightly Fallback-Update")
    System_Ext(cfWorker, "Cloudflare Worker", "API-Proxy & Leaderboard-Service<br/>isaqb-exam.enking.dev")
    System_Ext(cfKV, "Cloudflare KV", "Persistenter Datenspeicher für Fragen-Cache und Leaderboard-Einträge")
    System_Ext(ghOAuth, "GitHub OAuth", "Authentifizierung für Leaderboard-Submissions")
    System_Ext(googleOAuth, "Google OAuth", "Authentifizierung für Leaderboard-Submissions")
    System_Ext(upstream, "isaqb-org/foundation-exam-questions", "Offizieller Prüfungsfragenkatalog (XML)")
    System_Ext(localStorage, "Browser localStorage", "Client-seitiger Cache für Fragen, Exam-State, Leaderboard und Einstellungen")
    System_Ext(fonts, "api.fonts.coollabs.io", "Datenschutzfreundlicher Web-Font-Provider")

    Rel(user, app, "Nutzt", "HTTPS / Browser")
    Rel(lecturer, app, "Druckt / exportiert Ergebnisse", "Print / PDF")
    Rel(app, ghPages, "Deployt auf", "GitHub Actions → Static Files")
    Rel(app, cfWorker, "Lädt Fragen, reicht Scores ein, prüft Auth", "HTTPS / JSON")
    Rel(cfWorker, upstream, "Fetcht XML-Fragen (mit PAT)", "HTTPS")
    Rel(cfWorker, cfKV, "Speichert/liest Fragen-Cache und Leaderboard", "KV API")
    Rel(cfWorker, ghOAuth, "Authentifiziert Benutzer", "OAuth 2.0")
    Rel(cfWorker, googleOAuth, "Authentifiziert Benutzer", "OAuth 2.0")
    Rel(user, cfWorker, "OAuth-Login (GitHub / Google)", "HTTPS Redirect")
    Rel(ghActions, upstream, "Nightly: aktualisiert gebündelte Fallback-Fragen", "HTTPS")
    Rel(app, localStorage, "Liest / schreibt Exam-State, Fragen-Cache, Theme, Sprache")
    Rel(app, fonts, "Lädt Web-Fonts", "HTTPS / CSS")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

## Erläuterung der Systemgrenzen

| Bereich | Beschreibung |
|---|---|
| **Kernsystem** | React 19 Single-Page-Application mit Vite, TypeScript und Tailwind CSS v4 |
| **Nutzer** | *Prüfling* (nimmt Prüfung ab, reicht Leaderboard-Score ein) und *Dozent/Prüfer* (wertet exportierte Ergebnisse aus) |
| **Datenquelle** | Offizieller iSAQB-Fragenkatalog (`isaqb-org/foundation-exam-questions`) als XML via Cloudflare Worker |
| **API-Proxy** | Cloudflare Worker (`isaqb-exam.enking.dev`) — proxied GitHub-API mit PAT (kein Rate-Limit), cached Fragen im KV nach Commit-SHA |
| **Leaderboard** | Cloudflare Worker + KV — serverseitiges Re-Scoring, OAuth-basierte Spam-Prevention (GitHub + Google) |
| **Client-Speicher** | `localStorage` für Fragen-Cache (60 Min TTL), Exam-State, Theme und Spracheinstellungen |
| **Hosting** | GitHub Pages (statisch, kein Backend) |
| **Authentifizierung** | GitHub OAuth + Google OAuth via Cloudflare Worker (JWT-Sessions) |
| **Externe Dienste** | `api.fonts.coollabs.io` für datenschutzfreundliche Web-Fonts |
