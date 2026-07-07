import { Helmet } from 'react-helmet-async'
import { SeoMeta } from './SeoMeta'
import { StaticPageLayout } from './StaticPageLayout'

const questions = [
  {
    question: 'Onko Tärppi ilmainen?',
    answer: 'Kyllä. Tärppi on ilmainen työkalu opiskelijoille, eikä käytöstä veloiteta mitään.',
  },
  {
    question: 'Ostaako Tärppi liput automaattisesti puolestani?',
    answer: 'Tärppi voi yrittää lisätä valitsemasi liput Kide.app-koriin ja ilmoittaa siitä Telegramissa. Maksaminen tapahtuu aina itse Kide.appissa.',
  },
  {
    question: 'Tarvitseeko Tärppi Kide.app-salasanani?',
    answer: 'Ei tarvitse. Tärppi käyttää Kide.app-tokenia varauksen tekemiseen, mutta salasanaa tai maksukorttitietoja ei syötetä Tärppiin.',
  },
  {
    question: 'Miten saan Telegram Chat ID:ni?',
    answer: 'Avaa Telegram, etsi @Tarppibot ja aloita keskustelu komennolla /start. Botti lähettää Chat ID:n automaattisesti.',
  },
  {
    question: 'Toimiiko Tärppi kaikilla Kide.app-tapahtumilla?',
    answer: 'Tärppi toimii julkisilla Kide.app-tapahtumilla, joista Kide.app näyttää tarvittavat lipputiedot.',
  },
  {
    question: 'Onko Tärppi virallinen Kide.app-tuote?',
    answer: 'Ei. Tärppi on epävirallinen opiskelijatyökalu, eikä se liity Kide.app-yritykseen.',
  },
  {
    question: 'Kuinka nopeasti Tärppi ilmoittaa vapautuneista lipuista?',
    answer: 'Tärppi tarkistaa tapahtumia säännöllisesti. Ilmoitus tulee Telegramiin heti, kun Tärppi saa liput koriin tai huomaa seurannan kannalta olennaisen muutoksen.',
  },
  {
    question: 'Mitä tietoja Tärppi tallentaa minusta?',
    answer: 'Tärppi tallentaa seurannan kannalta tarvittavat tiedot, kuten Telegram Chat ID:n ja valitut tapahtumat. Salasanoja tai maksukorttitietoja ei tallenneta.',
  },
  {
    question: 'Toimiiko Tärppi Helsingin lisäksi muissa kaupungeissa?',
    answer: 'Kyllä. Tärppi tukee Kide.appin julkisia tapahtumakaupunkeja Suomessa.',
  },
]

const faqJsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: questions.map((item) => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.answer,
    },
  })),
}

export default function FAQPage() {
  return (
    <>
      <SeoMeta
        title="UKK - Usein kysytyt kysymykset | Tärppi"
        description="Vastaukset yleisimpiin kysymyksiin Tärpistä: miten botti toimii, onko se ilmainen ja mitä tietoja se tarvitsee."
        path="/ukk"
      />
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(faqJsonLd)}</script>
      </Helmet>
      <StaticPageLayout
        kicker="UKK"
        title="Usein kysytyt kysymykset"
        lead="Tärkeimmät vastaukset samassa paikassa. Jos mietit tokenia, Telegramia tai maksamista, aloita tästä."
      >
        <section className="seo-faq" aria-label="Usein kysytyt kysymykset">
          {questions.map((item) => (
            <article className="seo-question" key={item.question}>
              <h2>{item.question}</h2>
              <p>{item.answer}</p>
            </article>
          ))}
        </section>
      </StaticPageLayout>
    </>
  )
}
