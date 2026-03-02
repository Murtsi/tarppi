<p align="center">
  <img src="public/banner.svg" alt="Kidehiiri" width="700" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/React-19-61dafb?logo=react&style=flat-square" />
  <img src="https://img.shields.io/badge/TypeScript-5.9-3178c6?logo=typescript&style=flat-square" />
  <img src="https://img.shields.io/badge/Vite-7-646cff?logo=vite&style=flat-square" />
  <img src="https://img.shields.io/badge/AI-Koneoppiminen-ff6b6b?style=flat-square" />
</p>

---

## Mikä on Kidehiiri?

**Kidehiiri** on automaattinen lippuostaja [Kide.app](https://kide.app)-tapahtumiin. Se seuraa lippujen myyntiä reaaliajassa ja lisää ne ostoskoriin heti, kun ne tulevat saataville — nopeammin kuin käsin ikinä ehdit.

Sovellus sisältää myös **tekoälypohjaisen tapahtumapisteyttäjän**, joka analysoi tulevia tapahtumia ja kertoo mitkä niistä kannattaa napata.

> **Huom:** Kidehiiri hoitaa vain seurannan ja koriin lisäämisen. Maksaminen on aina sinun käsissäsi.

---

## Ominaisuudet

### Lippuostaja

Selkeä 5-vaiheinen ohjattu toiminto vie sinut alusta loppuun:

| Vaihe | Kuvaus |
|-------|--------|
| **1. Tapahtuma** | Liitä tapahtuman URL ja sovellus hakee tiedot automaattisesti |
| **2. Viive** | Säädä pollausväli (200 ms – 5 s) tarpeidesi mukaan |
| **3. Avainsanat** | Suodata lipputyypit avainsanoilla (esim. "early bird", "VIP") |
| **4. Yhteenveto** | Tarkista asetukset ennen seurannan käynnistämistä |
| **5. Seuranta** | Reaaliaikainen loki näyttää kaiken mitä tapahtuu |

- Automaattinen tokenin validointi ja vanhenemistarkistus
- Reaaliaikainen pollaus — reagoi heti kun liput tulevat myyntiin
- Toimii sekä tietokoneella että puhelimella

### AI-tapahtumapisteyttäjä

Tekoäly analysoi Kide.app-tapahtumia usean eri tekijän perusteella ja pisteyttää ne asteikolla 0–100:

- **Suosio** — kuinka paljon kiinnostusta tapahtuma herättää
- **Kysyntä** — lippujen saatavuus suhteessa kysyntään
- **Hinnoittelu** — onko hinta kohdallaan
- **Ajoitus** — myynnin ajankohta ja tapahtumapäivä
- **Järjestäjä** — tunnettuus ja historia

Pisteytyksen lisäksi koneoppimismalli luokittelee jokaisen tapahtuman kolmeen kategoriaan:

| Luokitus | Merkitys |
|----------|----------|
| 🟢 **BUY** | Kannattaa napata heti |
| 🟡 **MAYBE** | Seuraamisen arvoinen |
| 🔴 **SKIP** | Ei todennäköisesti kiinnosta |

Jokainen tapahtuma näyttää myös **AI-luottamuspalkin**, joka kertoo kuinka varma malli on ennusteestaan.

### Käyttöliittymä

- **Tumma teema** sulavailla animaatioilla
- **Mobiilioptimioitu** — toimii saumattomasti puhelimella
- **Suomi + englanti** — kielivalinta yhdellä klikkauksella
- **Saavutettava** — näppäimistönavigaatio, fokusindikaattorit, reduced-motion-tuki

---

## Teknologia

| | |
|---|---|
| **Käyttöliittymä** | React 19 + TypeScript 5.9 (strict mode) |
| **Rakennustyökalu** | Vite 7 — salamannopea kehitysympäristö |
| **Tyylit** | Puhdas CSS custom propertiesilla — ei UI-kirjastoja |
| **Tekoäly** | Heuristinen pisteytysmoottori + koneoppimismalli (scikit-learn) |
| **Kielituki** | Oma i18n-ratkaisu suomeksi ja englanniksi |
| **Julkaisu** | Vercel (frontend) — automaattinen CI/CD |

### Tekoälystä tarkemmin

Tapahtumapisteyttäjä toimii kahdessa vaiheessa:

1. **Heuristinen analyysi** — sääntöpohjainen moottori laskee pisteet viiden eri tekijän perusteella
2. **Koneoppiminen** — ML-malli (Random Forest) on koulutettu aiemmilla tapahtumadatalla ja uudelleenluokittelee tapahtumat BUY/MAYBE/SKIP-kategorioihin

Malli oppii jatkuvasti uusista tapahtumista ja parantaa ennusteitaan ajan myötä. Jos ML-palvelu ei ole saatavilla, sovellus näyttää silti heuristiset pisteet — toiminta ei koskaan keskeydy.

---

## Pika-aloitus

```bash
npm install
cp .env.example .env    # Aseta backend-palvelimen osoite
npm run dev             # → http://localhost:5173
```

## Ympäristömuuttujat

| Muuttuja | Kuvaus |
|----------|--------|
| `VITE_API_URL` | Backend-palvelimen osoite |

## Julkaisu (Vercel)

1. Yhdistä tämä repo [Verceliin](https://vercel.com)
2. Valitse framework: **Vite**
3. Aseta `VITE_API_URL` ympäristömuuttujiin
4. Deploy — valmis!

---

## Projektin rakenne

```
src/
├── App.tsx              # Pääsovellus — lippuostaja + pisteyttäjä
├── App.css              # Responsiiviset tyylit
├── components/
│   ├── CityPicker.tsx   # Kaupunkivalitsin haulla
│   ├── ErrorBoundary.tsx
│   └── Logo.tsx         # SVG-logot
└── lib/
    ├── translations.ts  # Suomi + englanti -käännökset
    └── kide/
        ├── api.ts       # API-kutsujen hallinta
        ├── types.ts     # Tyyppimäärittelyt
        └── kide-cities.json
```

---

<p align="center">
  <sub>Tehty Suomessa 🇫🇮</sub>
</p>

## Miten se toimii?

1. **Kaikki API-kutsut kulkevat backendin kautta** — selain ei koskaan ota suoraan yhteyttä kide.app:iin
2. Sovellus kyselee backendiä valitulla aikavälillä
3. Kun lippuja ilmestyy, backend lisää ne käyttäjän kide.app-ostoskoriin
4. Käyttäjä viimeistelee ostoksen itse kide.app:ssa

## Backend

Tämä frontend vaatii erillisen backend-palvelimen toimiakseen.

## Lisenssi

MIT
