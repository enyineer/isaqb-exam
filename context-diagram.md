# Kontextsicht — iSAQB CPSA-F Mock Exam

```mermaid
C4Context
    title Kontextsicht – iSAQB CPSA-F Mock Exam

    Person(user, "Prüfling", "Nutzt die Web-App, um eine iSAQB CPSA-F Probeprüfung abzulegen")
    Person(lecturer, "Dozent / Prüfer", "Erhält exportierte Ergebnisse inkl. Notizen zur Auswertung")

    System(app, "iSAQB Mock Exam", "React 19 SPA (Vite + TypeScript)<br/>Gehostet auf GitHub Pages")

    System_Ext(ghPages, "GitHub Pages", "Statisches Hosting der gebauten SPA")
    System_Ext(ghActions, "GitHub Actions", "CI/CD Pipeline + Leaderboard-Scoring-Workflow")
    System_Ext(ghIssues, "GitHub Issues", "Eingangskanal für Leaderboard-Submissions via Issue-Template")
    System_Ext(ghDiscussions, "GitHub Discussions", "Persistenter Datenspeicher für verifizierte Leaderboard-Einträge")
    System_Ext(ghAPI, "GitHub REST / GraphQL API", "Schnittstelle für Fragen-Fetch, Leaderboard-Lesen und -Schreiben")
    System_Ext(upstream, "isaqb-org/foundation-exam-questions", "Offizieller Prüfungsfragenkatalog (XML)")
    System_Ext(localStorage, "Browser localStorage", "Client-seitiger Cache für Fragen, Exam-State, Leaderboard und Einstellungen")
    System_Ext(fonts, "api.fonts.coollabs.io", "Datenschutzfreundlicher Web-Font-Provider")

    Rel(user, app, "Nutzt", "HTTPS / Browser")
    Rel(lecturer, app, "Druckt / exportiert Ergebnisse", "Print / PDF")
    Rel(app, ghPages, "Deployt auf", "GitHub Actions → Static Files")
    Rel(app, ghAPI, "Lädt Fragen (Contents API), liest Leaderboard (Discussions API)", "HTTPS / JSON")
    Rel(ghAPI, upstream, "Stellt XML-Fragendateien bereit", "raw.githubusercontent.com")
    Rel(user, ghIssues, "Reicht Leaderboard-Submission ein", "Pre-filled Issue URL")
    Rel(ghIssues, ghActions, "Triggert Scoring-Workflow", "on: issues opened")
    Rel(ghActions, upstream, "Fetcht Fragen am exakten Commit-SHA", "HTTPS")
    Rel(ghActions, ghDiscussions, "Postet verifiziertes Ergebnis", "GraphQL API")
    Rel(ghActions, ghIssues, "Schließt Issue mit Ergebnis-Kommentar", "REST API")
    Rel(app, localStorage, "Liest / schreibt Exam-State, Fragen-Cache, Theme, Sprache")
    Rel(app, fonts, "Lädt Web-Fonts", "HTTPS / CSS")

    UpdateLayoutConfig($c4ShapeInRow="3", $c4BoundaryInRow="1")
```

## Erläuterung der Systemgrenzen

| Bereich | Beschreibung |
|---|---|
| **Kernsystem** | React 19 Single-Page-Application mit Vite, TypeScript und Tailwind CSS v4 |
| **Nutzer** | *Prüfling* (nimmt Prüfung ab, reicht Leaderboard-Score ein) und *Dozent/Prüfer* (wertet exportierte Ergebnisse aus) |
| **Datenquelle** | Offizieller iSAQB-Fragenkatalog (`isaqb-org/foundation-exam-questions`) als XML via GitHub API |
| **Leaderboard-Pipeline** | GitHub Issues → GitHub Actions → GitHub Discussions (serverlose Architektur) |
| **Client-Speicher** | `localStorage` für Fragen-Cache (60 Min TTL), Exam-State, Theme und Spracheinstellungen |
| **Hosting** | GitHub Pages (statisch, kein Backend) |
| **Externe Dienste** | `api.fonts.coollabs.io` für datenschutzfreundliche Web-Fonts |
