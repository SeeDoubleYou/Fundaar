# Huis in de buurt

Je loopt langs een huis met een te-koop-bord en wilt er meer over weten.
Open de app en je ziet direct het adres waar je voor staat, met daaronder
de adressen in de buurt, gesorteerd op afstand. Bij elk adres staat een knop
om het op Funda op te zoeken.

## Hoe het werkt

1. De browser bepaalt je GPS-locatie.
2. De [PDOK Locatieserver](https://api.pdok.nl/bzk/locatieserver/search/v3_1/ui/)
   (gratis open data van de overheid, BAG-adressen) geeft de dichtstbijzijnde
   adressen terug, gesorteerd op afstand.
3. Per adres zijn er links naar Funda:
   - **Zoek dit huis op Funda**: zoekt het exacte adres op funda.nl via Google
     (Funda heeft geen vaste URL per adres die je zonder hun data kunt maken).
   - **Te koop in deze postcode**: opent Funda's zoekpagina voor de postcode.

De app weet zelf **niet** welke huizen te koop staan: Funda biedt daar geen
openbare API voor. Dat zie je pas op Funda zelf.

## Installeren op je telefoon

Locatie werkt alleen via HTTPS. De makkelijkste route is GitHub Pages:

1. Repo → *Settings* → *Pages* → *Deploy from a branch* → `main` / `(root)`.
2. Open de Pages-URL op je telefoon.
3. Voeg toe aan beginscherm (iOS: deelknop → *Zet op beginscherm*;
   Android: menu → *App installeren*).

## Lokaal draaien

```sh
python3 -m http.server 8000
```

Open daarna `http://localhost:8000` (localhost telt als veilige omgeving,
dus locatie werkt daar ook).

## Bestanden

- `index.html`, `style.css`, `app.js`: de app (geen build-stap, geen dependencies)
- `manifest.webmanifest`, `sw.js`, `icon*`: installeerbaar als PWA
