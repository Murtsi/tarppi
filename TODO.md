# Lipputerminaali — TODO / Parannuslista

Tärkeysjärjestyksessä. Kriittiset bugit → toiminnalliset ongelmat → UX-parannukset → koodivelka.

Viimeisin tarkistus: 2026-04-19 (koko codebasen skannaus + visuaalinen UI-auditointi)

---

## P0 — Kriittiset (rikkoo toiminnallisuutta)

- [x] **Kaupunkipickerin valintaloginen bugi** — Korjattu: "Kaikkialla" lähettää tyhjän stringin joka nyt toimii (ei skipata tyhjää cityä runScanissa). Logiviestissä näkyy "Kaikkialla" nimen sijaan.
- [x] **RightPanel useEffect puuttuvat riippuvuudet** — Korjattu: `onLoadDetail` callback tallennetaan `useRef`:llä, estäen stale closure -ongelmat ilman infinite loop -riskiä.
- [x] **Kaksoisrekisteröinti pikanäppäimillä** — Korjattu: Escape sulkee nyt vain päällimmäisen overlayn (drawer > palette > cityPicker). TokenDrawerin oma Escape-handler poistettu (App.tsx hoitaa keskitetysti). N-pikanäppäin tarkistaa nyt myös, ettei focus ole inputissa.

---

## P1 — Käyttöliittymäongelmat (haittaa käyttäjää merkittävästi)

- [x] **Kordinaattipalkin hakukenttä ei toimi kapealla näytöllä** — Korjattu: placeholder-teksti piilotetaan `@media (max-width: 768px)` -säännöllä.
- [x] **Kapealla näytöllä "Lipputerminaali"-otsikko leikkautuu** — Korjattu: lisätty `@media (max-width: 500px)` joka pienentää fonttikoon 24px:iin.
- [x] **Vasemman paneelin komentopalkki peittää keskipaneelin yläosan** — Korjattu: mobiilissa topbar ja cmdfield mukautuvat (flex-wrap, max-width none).
- [ ] **Oikea paneeli ei näy koskaan tyhjässä tilassa** — Oikea paneeli piiloutuu kun tapahtumaa ei ole valittu. Desktop-viewssa näkyy "Valitse tapahtuma tutkasta" -teksti.
- [x] **Tyhjä tila ("Ei tapahtumia") voisi olla informatiivisempi** — Korjattu: lisätty `scanError`-prop CenterPaneliin. Virhetilanteessa näytetään "Skannaus epäonnistui: [syy]. Tarkista backend-yhteys tai yritä uudelleen."
- [x] **TokenDrawerin overlay ei sulkeudu klikkaamalla taustaa** — Korjattu: overlay-diviin lisätty `onClick={onClose}` ja drawer-diviin `stopPropagation`.

---

## P2 — Käyttökokemus-parannukset (tekisi sovelluksesta helpomman)

- [x] **ErrorBoundary-teksti englanniksi** — Korjattu: käännetty suomeksi ("Jotain meni pieleen", "Yritä uudelleen", "Lataa sivu uudelleen").
- [x] **Komento-palette: pikanäppäin `N` avaa paletin vahingossa** — Korjattu: N-pikanäppäin tarkistaa nyt `e.target.tagName`, jottei inputissa kirjoittaessa avaa palettia.
- [x] **CityPicker: "Kaikkialla"-nollaus ei toimi loogisesti** — Korjattu: osana P0-korjausta. `runScan` ei enää ohita tyhjää kaupunkia.
- [ ] **Token-opas modaalina** — Token-ohjeistus on nyt pieni 4-askelen teksti asetuksissa. Selkeä erillinen opas/modaali 6 askeleella ja kuvilla auttaisi vähemmän teknisiä käyttäjiä.
- [ ] **"lastUpdatedLabel" ei päivity reaaliaikaisesti** — `lastUpdatedLabel` on `useMemo` joka riippuu `lastScanAt`:sta, mutta arvo lasketaan vain kerran ja pysyy jäädytettynä. Tarvitaan `useTick()`-hook päivittämään "x s/min sitten" -teksti sekunnin välein.
- [ ] **Lokipaneeli: virheloki ei erotu riittävästi** — "Skannaus epäonnistui: HTTP 500" näkyy lokissa, mutta teksti on small-caps monospace eikä erotu helposti muista logiriveistä. Voisi lisätä taustavärin tai ikonin virhelogeihin.

---

## P3 — Koodilaatu ja tekninen velka

- [ ] **ESLint 9 -konfiguraation korjaus** — `npm run lint` kaatuu frontendissa (`@humanfs/core` -bugi ESLint 9:n kanssa). Uudelleenkonfiguroitava toimivaksi.
- [ ] **Logo-komponentteja ei käytetä missään** — `Logo.tsx` sisältää 3 komponenttia (`KidehiiriIcon`, `TicketSniperIcon`, `KidehiiriLogo`), mutta niitä ei importata missään. Joko integroitava UI:iin (esim. header/footer) tai poistettava kuollut koodi.
- [ ] **Duplikaattiset `package.json`-tiedostot** — `frontend/package.json` ja juuritason `package.json` ovat identtiset. Tämä aiheuttaa hämmennystä. Selkeytettävä rakenne: poistettava toinen tai eriytettävä selkeästi.
- [ ] **CSS custom propertyt vs. JS token-vakiot** — `index.css` määrittelee `--lt-bg`, `--lt-ink` jne. mutta `tokens.ts` määrittelee samat arvot JS-puolella (`C.bg`, `C.ink`). Tämä on kaksoisylläpidettävä. Harkittava siirtymistä pelkkiin CSS custom propertyihin ja `var()`-kutsuihin inline-tyyleissä.
- [ ] **`runScan` kutsutaan city-efektin kautta ilman eslint-deps** — `useEffect(() => { runScan(city) }, [city])` rivi 128 ei listaa `runScan`ia riippuvuudeksi. Tämä toimii, koska `runScan` on `useCallback`, mutta puuttuva dep voi aiheuttaa stale closure -ongelmia jos `runScan`-deps muuttuvat.
- [ ] **Testien puuttuminen** — Ei yksikkö- eikä E2E-testejä. Lisättävä Vitest + React Testing Library yksikkötesteille ja Playwright E2E:lle.
- [ ] **npm audit: 5 haavoittuvuutta backend-riippuvuuksissa** — `npm audit` raportoi 2 moderate + 3 high. Ajettava `npm audit fix`.
- [ ] **`vercel.json` viittaa vanhoihin rewrite-sääntöihin** — Tarkistettava, vastaako `vercel.json` uutta frontend-rakennetta.

---

## Tehty ✓ (aikaisempi iteraatio)

- [x] Hintabugi: senteistä euroiksi (`RightPanel.tsx`)
- [x] Token-syöttö + asetuspainike UI:iin
- [x] Mac ⌘-symboli poistettu kaikkialta → Ctrl
- [x] CityPicker-uudelleensuunnittelu `lt-cityrow`-tyyleillä
- [x] Vite.svg favicon poistettu
- [x] Lokipaneeli collapsible LeftPaneliin
- [x] Uudelleenskannaus-painikkeet (header + SnipeSession-kortti)
- [x] Pistohistogrammi (10-ämpäri BUY/MAYBE/SKIP-jakauma)
- [x] Top-10 tapahtumat pikavalinta
- [x] AI-luottamustaso + malliversio per rivi
- [x] Viimeksi tarkistettu / seuraava tarkistus -laskuri MissionBarissa
- [x] Proxy URL -kenttä asetuksiin
- [x] `landedCount` tallentuu localStorageen
- [x] `avgLatency` piiloutuu idle-tilassa
- [x] `detailFor`-dedup nollataan `runScan`issa
- [x] `snipeRef` peilaa `snipe`-tilan
- [x] Kolmipaneeli-layout, SnipeSession-tilakaavio, CommandPalette, MissionBar
- [x] Fraunces + Geist Mono fontit, `lt-`-luokkaprefiksi, CSS custom property -järjestelmä
- [x] Suomenkielinen i18n tarkistus
