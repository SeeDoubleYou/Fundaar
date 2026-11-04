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

function render(addresses, accuracy) {
  if (!addresses.length) {
    setStatus("Geen adressen gevonden in de buurt van je locatie.");
    return;
  }
  const [first, ...rest] = addresses;

  $("#here-card").replaceChildren(renderAddress(first));
  $("#here").hidden = false;

  const list = $("#nearby-list");
  list.replaceChildren(...rest.map((a) => {
    const li = document.createElement("li");
    li.appendChild(renderAddress(a));
    return li;
  }));
  $("#nearby").hidden = rest.length === 0;

  if (accuracy > POOR_ACCURACY_M) {
    setStatus(`Je locatie is onnauwkeurig (±${Math.round(accuracy)} m). ` +
      "Het huis bovenaan is misschien niet het huis waar je voor staat; kijk ook in de lijst.", true);
  } else {
    setStatus(`Locatie tot op ±${Math.round(accuracy)} m nauwkeurig.`);
  }
}

function setStatus(text, warn = false) {
  statusEl.textContent = text;
  statusEl.classList.toggle("warn", warn);
}

// --- Locatie -------------------------------------------------------------------
function getPosition() {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("Je browser ondersteunt geen locatiebepaling."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
    });
  });
}

function locationErrorText(err) {
  switch (err && err.code) {
    case 1: return "Geen toestemming voor je locatie. Sta locatietoegang toe voor deze site en probeer opnieuw.";
    case 2: return "Je locatie kon niet worden bepaald. Probeer het buiten opnieuw.";
    case 3: return "Locatiebepaling duurde te lang. Probeer opnieuw.";
    default: return (err && err.message) || "Er ging iets mis.";
  }
}

let busy = false;
async function run() {
  if (busy) return;
  busy = true;
  document.body.classList.add("loading");
  setStatus("Locatie bepalen…");
  try {
    let pos;
    try {
      pos = await getPosition();
    } catch (err) {
      setStatus(locationErrorText(err), true);
      return;
    }
    setStatus("Adressen zoeken…");
    const { latitude, longitude, accuracy } = pos.coords;
    try {
      render(await fetchNearby(latitude, longitude), accuracy);
    } catch (err) {
      setStatus(`Adressen ophalen mislukt: ${err.message}`, true);
    }
  } finally {
    busy = false;
    document.body.classList.remove("loading");
  }
}

$("#refresh").addEventListener("click", run);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") run();
});
run();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
