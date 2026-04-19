# Lipputerminaali — TODO / Parannuslista

Prioriteettijärjestyksessä. Kriittiset bugit ensin, sitten puuttuvat ominaisuudet.

---

## P0 — Kriittiset bugit (rikkoo toiminnallisuuden)

- [ ] **Hintabugi: senteistä euroiksi** — `RightPanel.tsx` rivit ~150-153 ja `CenterPanel.tsx`: `v.price` ja `v.pricePerItem` ovat senttejä (Kide API), ei euroja. Jakaa 100:lla ennen näyttöä. Nyt 5800 näkyy "5800€" eikä "58€".
- [ ] **Token-syöttö puuttuu UI:sta** — "Token puuttuu" -teksti vasemmalla ei avaa asetuksia. Käyttäjällä ei ole selvää paikkaa syöttää tokenia ilman ⌘K-tietoa.
- [ ] **Asetuspainike puuttuu** — Vasemman paneelin alareunaan settings-ikoni (⚙) joka avaa `TokenDrawer`-vetolipun suoraan. Ei pelkästään command paletten kautta.

---

## P1 — Käyttöliittymävirheet (haittaa käyttöä merkittävästi)

- [ ] **Mac ⌘-symboli poistetaan kaikkialta** — `commands`-arrayn `hint`-kentät, bottom-right hint-palkki, kaikki `⌘K`-viittaukset → vaihda `Ctrl+K` tai poista kokonaan.
- [ ] **CityPicker-uudelleensuunnittelu** — Nykyinen `<select>`-elementti ei sovi Lipputerminaali-tyyliin. Korvaa custom-dropdownilla joka käyttää `lt-`-luokkaprefiksiä ja `C`/`F`-tokeneita.
- [ ] **Komento-palette toiminnallisuuden tarkistus** — Komennot tuntuvat rikkoutuneilta. Tarkista että jokainen `run()`-callback toimii oikein, erityisesti "Avaa asetukset" ja scan-komennot.
- [ ] **Vite.svg favicon poistetaan** — `index.html` linkittää `/vite.svg`-ikoniin. Vaihda projektikohtaiseen tai poista.

---

## P2 — Puuttuvat ominaisuudet (olivat vanhassa koodissa)

- [ ] **Lokipaneeli** — `logs`-tila (`LogLine[]`, max 40) täyttyy `pushLog`-kutsulla mutta ei renderöidy missään. Lisää `<LogPanel>` joka näyttää lokit oikeassa sivupalkissa tai alareunassa.
- [ ] **Uudelleenskannaus-painike** — Erillinen "Skannaa uudelleen" -nappi, ei vain command paletten kautta. Sijoitus: keskipaneelin yläosa tai MissionBar.
- [ ] **Uudelleen skannaus -painike seurantakorttiin** — SnipeSession-kortissa pitäisi olla mahdollisuus käynnistää uusi skannaus ilman koko sivu-refresh.

---

## P3 — Puuttuvat ominaisuudet (uusia / parannuksia)

- [ ] **Pistohistogrammi** — 10-ämpärin BUY/MAYBE/SKIP-jakauma tapahtumista. Näyttää scanning-tuloksen visuaalisesti.
- [ ] **Top-10 tapahtumat pikavalinta** — Nopea "Top 10" -filtteritoggle joka rajaa listan parhaisiin tuloksiin.
- [ ] **AI-luottamustaso + malliversio per rivi** — `ai_score.buy_probability` + `ai_score.model_version` -merkki jokaisen tapahtumarivin yhteydessä kun AI-reranker on käytössä.
- [ ] **Token-opas modal** — 6-vaiheinen ohje kuinka hakea Kide.app JWT-token selaimen developer toolsista. Avautuu TokenDrawerista "Miten saan tokenin?"-linkistä.
- [ ] **Viimeksi tarkistettu / seuraava tarkistus -laskuri** — MissionBarissa tai seurantakortissa: "Tarkistettu 23s sitten · Seuraava 37s päästä".
- [ ] **Proxy URL -kenttä asetuksiin** — Backend hyväksyy edelleen proxy-URL:n. Lisää kenttä TokenDraweriin.

---

## P4 — Koodivelka ja arkkitehtuuriparannukset

- [ ] **`landedCount` ei tallennu localStorageen** — Resetoituu sivunlatauksessa. Tallenna localStorageen muiden asetusten tapaan.
- [ ] **`avgLatency` harhaanjohtava idles-tilassa** — Näytetään vain aktiivisen snipen aikana, muuten piilotetaan tai näytetään `—`.
- [ ] **`detailFor`-dedup estää uudelleenlatauksen** — `detailFor` on `Map<eventId, KideProduct>` eikä tyhjene scanin jälkeen. Harkitse tyhjennys uudella skannauksella.
- [ ] **`startSnipe` voi napata vanhentuneen closure-viitteen** — `snipe`-tila voidaan lukea vanhasta closuresta. Refaktoroi `useRef`-pohjaiseksi tai tarkista riippuvuudet.
- [ ] **`pushLog` määritelty `runScan`-funktion jälkeen** — Toimii React-closure-semantiikalla mutta on arkkitehtuuri-haaste. Siirrä `pushLog` ennen `runScan`:ia tai erota omaan hookkiin.

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
