"use strict";

// PDOK Locatieserver (open data, BAG-adressen). Reverse geocoding geeft
// adressen terug gesorteerd op afstand tot het opgegeven punt.
const PDOK_REVERSE = "https://api.pdok.nl/bzk/locatieserver/search/v3_1/reverse";
const MAX_RESULTS = 15;
const POOR_ACCURACY_M = 30;

const $ = (sel) => document.querySelector(sel);
const statusEl = $("#status");

// --- Links naar Funda -------------------------------------------------------
// Funda heeft geen openbare API of vaste URL per adres. Daarom:
// - "dit huis": zoek het exacte adres op funda.nl via een zoekmachine;
// - "deze postcode": open Funda's eigen zoekpagina voor de postcode.
function fundaAddressUrl(a) {
  // Funda schrijft huisletters/toevoegingen met streepje ("Oudegracht 5-G",
  // URL ".../appartement-oudegracht-5-g/..."). Door alles als losse woorden
  // in een zoekzin te zetten, matcht de zoekmachine zowel titel als URL.
  // Zonder letter matcht "Oudegracht 156" ook 156-A, 156-1 enz. (gewenst).
  // De "\" vooraan is DuckDuckGo's "spring naar eerste resultaat": je komt
  // direct op de advertentie uit, zonder resultatenpagina.
  const q = `\\site:funda.nl/detail/koop "${a.searchPhrase}" ${a.city} -verkocht`;
  return "https://duckduckgo.com/?q=" + encodeURIComponent(q);
}

function fundaAreaUrl(a) {
  const pc = a.postcode.replace(/\s+/g, "").toLowerCase();
  const area = pc || a.city.toLowerCase();
  return "https://www.funda.nl/zoeken/koop?selected_area=" +
    encodeURIComponent(JSON.stringify([area]));
}

// --- Data -------------------------------------------------------------------
function toAddress(doc) {
  const nr = [doc.huisnummer, doc.huisletter].filter(Boolean).join("") +
    (doc.huisnummertoevoeging ? "-" + doc.huisnummertoevoeging : "");
  return {
    street: `${doc.straatnaam} ${nr}`.trim(),
    postcode: (doc.postcode || "").replace(/^(\d{4})\s*([A-Za-z]{2})$/, "$1 $2"),
    city: doc.woonplaatsnaam || "",
    searchPhrase: [doc.straatnaam, doc.huisnummer, doc.huisletter, doc.huisnummertoevoeging]
      .filter(Boolean).join(" "),
    distance: typeof doc.afstand === "number" ? doc.afstand : null,
  };
}

async function fetchNearby(lat, lon) {
  const params = new URLSearchParams({
    lat: lat.toFixed(6),
    lon: lon.toFixed(6),
    type: "adres",
    rows: String(MAX_RESULTS),
    fl: "straatnaam,huisnummer,huisletter,huisnummertoevoeging,postcode,woonplaatsnaam,afstand",
  });
  const res = await fetch(`${PDOK_REVERSE}?${params}`);
  if (!res.ok) throw new Error(`PDOK gaf status ${res.status}`);
  const json = await res.json();
  const docs = (json.response && json.response.docs) || [];
  return docs.map(toAddress).sort((a, b) => (a.distance ?? 1e9) - (b.distance ?? 1e9));
}

// --- Weergave ----------------------------------------------------------------
function formatDistance(m) {
  if (m == null) return "";
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
}

function renderAddress(a) {
  const node = $("#addr-tpl").content.firstElementChild.cloneNode(true);
  node.querySelector(".street").textContent = a.street;
  node.querySelector(".place").textContent = [a.postcode, a.city].filter(Boolean).join(" ");
  node.querySelector(".dist").textContent = formatDistance(a.distance);
  node.querySelector(".funda-addr").href = fundaAddressUrl(a);
  const area = node.querySelector(".funda-area");
  area.href = fundaAreaUrl(a);
  area.textContent = a.postcode ? `Te koop in ${a.postcode}` : `Te koop in ${a.city}`;
  return node;
}

// --- Toestand ---------------------------------------------------------------
let addresses = [];      // laatst opgehaalde adressen, op afstand gesorteerd
let selected = 0;        // index van het huis bovenaan
let manual = false;      // gebruiker heeft zelf een huis gekozen
let best = null;         // beste (nauwkeurigste) positie tot nu toe
let watchId = null;
let watchTimer = null;

function render() {
  if (!addresses.length) {
    $("#here").hidden = true;
    $("#nearby").hidden = true;
    return;
  }
  const first = addresses[selected];
  const rest = addresses.filter((_, i) => i !== selected);

  $("#here-card").replaceChildren(renderAddress(first));
  $("#here").hidden = false;

  const list = $("#nearby-list");
  list.replaceChildren(...rest.map((a) => {
    const li = document.createElement("li");
    li.appendChild(renderAddress(a));
    li.addEventListener("click", (e) => {
      if (e.target.closest("a")) return; // Funda-knop gewoon laten werken
      selectAddress(a);
    });
    return li;
  }));
  $("#nearby").hidden = rest.length === 0;
}

function selectAddress(a) {
  selected = addresses.indexOf(a);
  manual = true;
  stopWatch();
  render();
  updateStatus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateStatus() {
  if (!best) return;
  const acc = Math.round(best.accuracy);
  if (manual) {
    setStatus("Je hebt zelf een huis gekozen. Tik op ↻ om opnieuw te zoeken.");
  } else if (watchId !== null) {
    setStatus(`Locatie verfijnen… nu ±${acc} m. Blijf even stilstaan.`);
  } else if (best.accuracy > POOR_ACCURACY_M) {
    setStatus(`Je locatie is onnauwkeurig (±${acc} m). ` +
      "Staat het verkeerde huis bovenaan? Tik op het juiste huis in de lijst.", true);
  } else {
    setStatus(`Locatie tot op ±${acc} m nauwkeurig.`);
  }
}

function setStatus(text, warn = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("warn", warn);
}

// --- Adressen ophalen (nooit twee tegelijk; altijd voor de nieuwste positie) ---
let fetching = false;
let fetchAgain = false;
async function refreshAddresses() {
  if (fetching) { fetchAgain = true; return; }
  fetching = true;
  try {
    const result = await fetchNearby(best.latitude, best.longitude);
    if (!manual) {
      addresses = result;
      selected = 0;
      render();
      if (!result.length) setStatus("Geen adressen gevonden in de buurt van je locatie.");
      else updateStatus();
    }
  } catch (err) {
    setStatus(`Adressen ophalen mislukt: ${err.message}`, true);
  } finally {
    fetching = false;
    if (fetchAgain) { fetchAgain = false; refreshAddresses(); }
  }
}

// --- Locatie: blijf meeluisteren tot de GPS nauwkeurig genoeg is --------------
// De eerste meting komt vaak van wifi/zendmasten (tientallen meters ernaast).
// GPS heeft een paar seconden nodig; elke betere meting werkt de lijst bij.
const GOOD_ACCURACY_M = 10;
const WATCH_MAX_MS = 30000;

function metersBetween(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const x = (b.longitude - a.longitude) * rad * Math.cos(((a.latitude + b.latitude) / 2) * rad);
  const y = (b.latitude - a.latitude) * rad;
  return Math.hypot(x, y) * R;
}

function onPosition(pos) {
  const p = {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
  };
  const better = !best || p.accuracy < best.accuracy * 0.8;
  const moved = best && metersBetween(best, p) > Math.max(10, p.accuracy);
  if (better || moved) {
    best = p;
    refreshAddresses();
  }
  if (p.accuracy <= GOOD_ACCURACY_M) stopWatch();
  updateStatus();
}

function onPositionError(err) {
  if (best) return; // we hebben al een positie; negeren
  stopWatch();
  setStatus(locationErrorText(err), true);
}

function locationErrorText(err) {
  switch (err && err.code) {
    case 1: return "Geen toestemming voor je locatie. Sta locatietoegang toe voor deze site en probeer opnieuw.";
    case 2: return "Je locatie kon niet worden bepaald. Probeer het buiten opnieuw.";
    case 3: return "Locatiebepaling duurde te lang. Probeer opnieuw.";
    default: return (err && err.message) || "Er ging iets mis.";
  }
}

function startWatch() {
  stopWatch();
  if (!("geolocation" in navigator)) {
    setStatus("Je browser ondersteunt geen locatiebepaling.", true);
    return;
  }
  best = null;
  manual = false;
  setStatus("Locatie bepalen…");
  document.body.classList.add("loading");
  watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
    enableHighAccuracy: true,
    timeout: 20000,
    maximumAge: 0,
  });
  watchTimer = setTimeout(() => { stopWatch(); updateStatus(); }, WATCH_MAX_MS);
}

function stopWatch() {
  if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  clearTimeout(watchTimer);
  watchId = null;
  watchTimer = null;
  document.body.classList.remove("loading");
}

$("#refresh").addEventListener("click", startWatch);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") startWatch();
  else stopWatch();
});
startWatch();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
