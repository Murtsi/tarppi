# Lipputerminaali — TODO / Parannuslista

Prioriteettijärjestyksessä. Kriittiset bugit ensin, sitten puuttuvat ominaisuudet.

---

## P0 — Kriittiset bugit (rikkoo toiminnallisuuden)

- [x] **Hintabugi: senteistä euroiksi** — `RightPanel.tsx`: `v.price`/`v.pricePerItem` jaetaan 100:lla.
- [x] **Token-syöttö puuttuu UI:sta** — Footer-rivi on nyt klikkattava ⚙-painike joka avaa TokenDrawerin.
- [x] **Asetuspainike puuttuu** — `LeftPanel` footer: "Aseta token →" / ⚙ avaa TokenDrawerin.

---

## P1 — Käyttöliittymävirheet (haittaa käyttöä merkittävästi)

- [x] **Mac ⌘-symboli poistetaan kaikkialta** — Poistettu/vaihdettu Ctrl+K / Ctrl+,.
- [x] **CityPicker-uudelleensuunnittelu** — Uusi komponentti `lt-cityrow`-tyyleillä, ei legacy CSS.
- [ ] **Komento-palette toiminnallisuuden tarkistus** — Komennot toimivat teknisesti. UX-parannus voi olla tarpeen myöhemmin.
- [ ] **Vite.svg favicon poistetaan** — `index.html` linkittää `/vite.svg`-ikoniin.

---

## P2 — Puuttuvat ominaisuudet (olivat vanhassa koodissa)

- [x] **Lokipaneeli** — `LeftPanel`-alatunnisteessa collapsible log-strip; näyttää viimeiset 10 logia.
- [x] **Uudelleenskannaus-painike** — ⟳-painike `CenterPanel`-otsikossa kaupunkipilin vieressä.
- [ ] **Uudelleen skannaus -painike seurantakorttiin** — SnipeSession-korttiin oma skannaus-nappi.

---

## P3 — Puuttuvat ominaisuudet (uusia / parannuksia)

- [ ] **Pistohistogrammi** — 10-ämpärin BUY/MAYBE/SKIP-jakauma tapahtumista.
- [ ] **Top-10 tapahtumat pikavalinta** — "Top 10" -filtteritoggle.
- [x] **AI-luottamustaso + malliversio per rivi** — Pieni "AI" -merkki nimen alla, väri vastaa labelia, hover näyttää model_version.
- [ ] **Token-opas modal** — 6-vaiheinen ohje JWT-tokenin hakemiseen.
- [ ] **Viimeksi tarkistettu / seuraava tarkistus -laskuri** — MissionBarissa.
- [ ] **Proxy URL -kenttä asetuksiin** — TokenDraweriin.

---

## P4 — Koodivelka ja arkkitehtuuriparannukset

- [x] **`landedCount` ei tallennu localStorageen** — Nyt tallentuu `kh.landed`-avaimella.
- [x] **`avgLatency` harhaanjohtava idles-tilassa** — Latencies tyhjennetään `stopSnipe`:ssa, joten `avgLatencyMs` piiloutuu idle-tilassa.
- [x] **`detailFor`-dedup estää uudelleenlatauksen** — `runScan` nollaa `detailFor`:n.
- [x] **`startSnipe` voi napata vanhentuneen closure-viitteen** — `snipeRef` (`useRef`) peilaa `snipe`-tilan.
- [ ] **`pushLog` määritelty `runScan`-funktion jälkeen** — Toimii, mutta arkkitehtuuri-haaste.

---

## Tehty ✓

- [x] Tiketti-integraatio poistettu kokonaan (frontend)
- [x] Lipputerminaali kolmipaneeli-layout (Seurannat / Tutka / Zoom)
- [x] SnipeSession-tilakaavio (hunting → waiting → landed | error)
- [x] CommandPalette + TokenDrawer komponentit
- [x] MissionBar (pollaus/yrityksiä/aikaa stats)
- [x] Fraunces + Geist Mono fontit
- [x] `lt-`-luokkaprefiksi + CSS custom property -järjestelmä
- [x] Suomenkielinen i18n tarkistus ja korjaukset
- [x] CityPicker props-yhteensopivuus korjattu
