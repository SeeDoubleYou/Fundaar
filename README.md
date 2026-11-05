# fundaar

> **Status: gestopt.** Het idee is niet levensvatbaar zonder directe koppeling
> met Funda. Zie [Conclusie](#conclusie).

## Het idee

Je loopt langs een huis met een te-koop-bord en wilt er meer over weten.
Je opent de app en ziet direct dat huis, met daaronder de andere huizen die
in de buurt te koop staan, gesorteerd op afstand vanaf je exacte locatie.

## Wat er gebouwd is

Een kleine webapp (PWA, geen build-stap) die:

1. je locatie bepaalt via de browser en blijft verfijnen tot de GPS
   nauwkeurig genoeg is;
2. via de [PDOK Locatieserver](https://api.pdok.nl/bzk/locatieserver/search/v3_1/ui/)
   (open BAG-data van de overheid) de dichtstbijzijnde **adressen** ophaalt,
   gesorteerd op afstand;
3. per adres doorlinkt naar Funda: de zoekpagina voor de postcode, of via
   DuckDuckGo direct naar de eerste Funda-advertentie voor dat adres.

Live: <https://seedoubleyou.dev/fundaar/>

## Conclusie

De kern van het idee is **alleen huizen die echt te koop staan**, gesorteerd
op exacte afstand. Dat lukt niet zonder Funda's data:

- **Welke huizen te koop staan, weet alleen Funda** (of een makelaar). Funda
  heeft geen openbare API; de partner-API is alleen voor makelaars en
  zakelijke partners.
- **Sorteren op afstand** vereist de locaties van alle te-koop-huizen in de
  buurt tegelijk. Zonder die data kan de app alleen *adressen* tonen en
  hopen dat er een advertentie bij hoort.
- **Omwegen via zoekmachines** (Google, DuckDuckGo) zijn te grof: veel ruis,
  of een lege pagina als het adres niet te koop staat.
- **Scrapen** van Funda is in strijd met hun voorwaarden en wordt actief
  geblokkeerd; dat is bewust niet gedaan.

Wat wél goed werkt: locatie tot op ±5–15 m (mits *Exacte locatie* aan staat
op de telefoon), adressen op afstand sorteren, en de interface. Met toegang
tot Funda-data (bijv. via de partner-API of een makelaar) kan dit vrij
direct worden afgemaakt: vervang de PDOK-adressen door te-koop-advertenties
met coördinaten, de rest kan blijven.

## Lokaal draaien

```sh
python3 -m http.server 8000
```

Open daarna `http://localhost:8000` (localhost telt als veilige omgeving,
dus locatie werkt daar ook).

## Bestanden

- `index.html`, `style.css`, `app.js`: de app (geen dependencies)
- `manifest.webmanifest`, `sw.js`, `icon*`: installeerbaar als PWA
