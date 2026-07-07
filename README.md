# Tärppi Frontend

Tärppi on selainkäyttöinen Kide.app-seurantatyökalu opiskelijatapahtumiin. Käyttäjä valitsee tapahtuman, lipputyypin ja määrän. Tärppi seuraa myyntiä ja yrittää lisätä valitut liput Kide.app-koriin, kun niitä on saatavilla.

Maksaminen tehdään aina itse Kide.appissa. Tärppi ei käsittele maksukortteja eikä osta lippuja loppuun asti.

- Live-sivu: [tarppi.site](https://www.tarppi.site)
- GitHub: [Tärppi frontend](https://github.com/Murtsi/Kidehiiri-public)
- Tekijä: [Antti Murtokangas](https://www.anttimurtokangas.com)

## Mitä käyttäjä tarvitsee?

Tärkein asetus on **Kide.app-token**. Ilman sitä Tärppi ei voi lisätä lippuja käyttäjän koriin.

Token tallennetaan vain selaimen istunnon ajaksi. Kun selain suljetaan, token pitää lisätä tarvittaessa uudelleen.

Telegram Chat ID on vapaaehtoinen. Sitä tarvitaan vain, jos käyttäjä haluaa lisäilmoituksia Telegramiin, esimerkiksi kun liput ovat korissa.

Peruskäyttö:

1. Lisää Kide.app-token asetuksista.
2. Tarkista, että token toimii.
3. Valitse kaupunki tai liitä suora Kide.app-tapahtuman linkki.
4. Valitse tapahtuma, lipputyyppi ja määrä.
5. Käynnistä seuranta.
6. Kun liput ovat korissa, avaa Kide.app ja maksa itse.

## Miten tapahtumat haetaan?

Frontend kutsuu Tärpin API-palvelua:

```text
Frontend -> Tärpin API -> Kide.appin tapahtumalista -> tapahtumat käyttöliittymään
```

Tärppi ei lue Kiden sivulla näkyvää lukua sellaisenaan. API hakee listauksen valitulla kaupunkirajauksella ja suodattaa sen jälkeen pois esimerkiksi:

- päättyneet tapahtumat
- loppuunmyydyt tapahtumat, joiden myynti on jo alkanut
- ilmaiset tapahtumat

Tulossa olevat myynnit pidetään mukana, vaikka saatavuus olisi vielä nolla.

Tästä syystä luvut voivat erota Kiden omalla sivulla näkyvästä määrästä. Jos kaupungiksi valitaan **Kaikki**, lista on luonnollisesti suurempi kuin yksittäisen kaupungin näkymä.

## Projektin pääosat

| Osa | Tarkoitus |
|---|---|
| `src/App.tsx` | Sovelluksen päätila, seurannan käynnistys ja reititys |
| `src/components/lt/SimpleDashboard.tsx` | Päätason käyttöliittymä: tapahtumat, lipputyypit, logi ja seurannan tila |
| `src/components/lt/TokenDrawer.tsx` | Asetukset: token, Telegram-ilmoitukset, pollausväli ja ulkoasu |
| `src/components/lt/SimpleCityPicker.tsx` | Kaupunkivalinta ja Kaikki-rajaus |
| `src/pages/` | Julkiset infosivut: Miten toimii, UKK ja Tietoa |
| `src/lib/kide/api.ts` | Frontendin API-client |
| `src/lib/kide/types.ts` | API-vastausten TypeScript-tyypit |

## Reitit

| Reitti | Sisältö |
|---|---|
| `/` | Varsinainen Tärppi-sovellus |
| `/miten-toimii` | Käyttöönoton vaiheet ja tokenin rooli |
| `/ukk` | Usein kysytyt kysymykset |
| `/tietoa` | Tausta, tekniikka ja GitHub-linkki |

Staattiset SEO-tiedot ovat `index.html`-tiedostossa ja sivukohtaiset metatiedot `src/pages/SeoMeta.tsx`-komponentin kautta.

## Ympäristömuuttujat

Paikallinen kehitys voi kutsua API-palvelua suoraan:

```bash
VITE_API_URL=http://localhost:3000
```

Vercelissä frontend käyttää same-origin `/api`-polkuja. Palvelun varsinainen osoite kuuluu server-puolen ympäristömuuttujaan:

```bash
API_PROXY_URL=https://api.example.com
```

Älä käytä tuotannossa `VITE_`-prefiksillä alkavaa muuttujaa salaiselle tai sisäiselle osoitteelle. Vite bundlaa sellaiset selaimeen.

## Kehitys

Asenna riippuvuudet ja aja tarkistukset:

```bash
npm install
npm test
npm run lint
npm run build
npm run dev
```

## Turvarajat

Tärppi voi lisätä liput koriin, mutta ei maksa niitä. Käyttäjä vastaa itse Kide.app-tokenista, lipputyypin valinnasta ja maksusta Kide.appissa.

Älä lisää repoihin tokeneita, ympäristömuuttujia tai muita salaisuuksia. Frontendissä näkyvä koodi on julkista.

Tärppi on epävirallinen työkalu. Se ei ole Kide.appin tuote, eikä Kide.app vastaa sen toiminnasta.
