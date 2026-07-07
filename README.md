# Tärppi Frontend

Tärppi on Kide.app-tapahtumien seurantaan tehty selainkäyttöliittymä. Käyttäjä valitsee tapahtuman, lipputyypin ja määrän. Tärppi seuraa myyntiä backendin kautta ja yrittää lisätä valitut liput Kide.app-koriin, kun niitä on saatavilla.

Maksaminen tehdään aina itse Kide.appissa. Tärppi ei käsittele maksukortteja eikä osta lippuja loppuun asti.

- Live-sivu: [tarppi.site](https://www.tarppi.site)
- Julkinen frontend-repo: [Murtsi/Kidehiiri-public](https://github.com/Murtsi/Kidehiiri-public)
- Tekijä: [Antti Murtokangas](https://www.anttimurtokangas.com)

Tämä kansio sisältää vain frontendin. Backend, Kide.app-varauslogiikka, Railway-asetukset ja muut palvelinpuolen osat pidetään erillisessä yksityisessä repossa.

## Mitä käyttäjä tarvitsee?

Tärkein asetus on **Kide.app-token**. Ilman sitä Tärppi ei voi lisätä lippuja käyttäjän koriin.

Telegram Chat ID on vapaaehtoinen. Sitä tarvitaan vain, jos käyttäjä haluaa lisäilmoituksia Telegramiin, esimerkiksi kun liput ovat korissa.

Peruskäyttö:

1. Lisää Kide.app-token asetuksista.
2. Tarkista, että token toimii.
3. Valitse kaupunki tai liitä suora Kide.app-tapahtuman linkki.
4. Valitse tapahtuma, lipputyyppi ja määrä.
5. Käynnistä seuranta.
6. Kun liput ovat korissa, avaa Kide.app ja maksa itse.

## Miten Tärppi hakee tapahtumat?

Frontend kutsuu Railwaylla ajettavaa backendia:

```text
Frontend -> /api/scan -> Kide.app listing API -> pisteytys -> tapahtumalista
```

Tärppi ei lue Kiden sivulla näkyvää tapahtumamäärää sellaisenaan. Backend hakee Kide.appin listauksen valitulla kaupunkirajauksella ja suodattaa sen jälkeen pois esimerkiksi:

- päättyneet tapahtumat
- loppuunmyydyt tapahtumat, joiden myynti on jo alkanut
- ilmaiset tapahtumat

Tulossa olevat myynnit pidetään mukana, vaikka saatavuus olisi vielä nolla.

Tästä syystä luvut voivat näyttää erilaisilta kuin Kiden omalla sivulla. Esimerkiksi tarkistuksessa Helsinki-haku palautti Kiden rajapinnasta 68 tuotetta, joista Tärppi näytti 54. Kun kaupungiksi valittiin **Kaikki**, backend haki koko listauksen: 160 tuotetta, joista Tärppi näytti 119.

## Pääosat

| Osa | Tarkoitus |
|---|---|
| `src/App.tsx` | Sovelluksen päätila, seurannan käynnistys, tokenin käsittely ja reititys |
| `src/components/lt/SimpleDashboard.tsx` | Päätason käyttöliittymä: tapahtumat, lipputyypit, logi ja seurannan tila |
| `src/components/lt/TokenDrawer.tsx` | Asetukset: Kide.app-token, Telegram-ilmoitukset, pollausväli ja ulkoasu |
| `src/components/lt/SimpleCityPicker.tsx` | Kaupunkivalinta ja Kaikki-rajaus |
| `src/pages/` | Julkiset infosivut: Miten toimii, UKK ja Tietoa |
| `src/lib/kide/api.ts` | Frontendin API-client backendia varten |
| `src/lib/kide/types.ts` | Backend-vastausten TypeScript-tyypit |

## Reitit

| Reitti | Sisältö |
|---|---|
| `/` | Varsinainen Tärppi-sovellus |
| `/miten-toimii` | Käyttöönoton vaiheet ja tokenin rooli |
| `/ukk` | Usein kysytyt kysymykset |
| `/tietoa` | Tausta, tekniikka ja julkisen frontend-repon linkki |

Staattiset SEO-tiedot ovat `index.html`-tiedostossa ja sivukohtaiset metatiedot `src/pages/SeoMeta.tsx`-komponentin kautta.

## Ympäristömuuttujat

Frontend tarvitsee backendin osoitteen:

```bash
VITE_API_URL=https://your-tarppi-backend.up.railway.app
```

Paikallisesti:

```bash
VITE_API_URL=http://localhost:3000
```

Jos `VITE_API_URL` puuttuu, sovellus pysähtyy backend-asetuksen virhetilaan eikä arvaa osoitetta itse.

## Kehitys

Asenna riippuvuudet ja aja tarkistukset:

```bash
npm install
npm test
npm run build
npm run dev
```

Hyödyllinen perusrytmi muutoksia tehdessä:

```bash
npm test
npm run lint
npm run build
```

## Vercel

Vercelin asetukset:

| Asetus | Arvo |
|---|---|
| Root directory | `frontend` |
| Framework preset | Vite |
| Build command | `npm run build` |
| Output directory | `dist` |

Sovellus tarkistaa käynnistyessä `${VITE_API_URL}/health`. Jos backend ei vastaa, käyttäjälle näytetään yhteysvirhe.

## Julkiseen repoon julkaisu

Julkiseen GitHub-repoon työnnetään vain `frontend/`-kansion sisältö:

```bash
git subtree split --prefix=frontend -b public-deploy
git push public public-deploy:main --force
git branch -D public-deploy
```

Älä työnnä julkiseen repoon:

- `backend/`
- `ai-reranker/`
- Railwayn asetuksia
- Kide.app-varauslogiikkaa
- automaationestoon tai deobfuskointiin liittyvää koodia
- salaisuuksia tai ympäristömuuttujia

## Turvarajat

Tärppi voi lisätä liput koriin, mutta ei maksa niitä. Käyttäjä vastaa itse Kide.app-tokenista, lipputyypin valinnasta ja maksusta Kide.appissa.

Tärppi on epävirallinen työkalu. Se ei ole Kide.appin tuote, eikä Kide.app vastaa sen toiminnasta.
