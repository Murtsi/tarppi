import { Link } from 'react-router-dom'
import { SeoMeta } from './SeoMeta'
import { StaticPageLayout } from './StaticPageLayout'

const steps = [
  {
    title: 'Avaa @Tarppibot Telegramissa',
    body: 'Etsi Telegramista @Tarppibot ja kirjoita /start. Botti vastaa Chat ID:llä, jonka Tärppi tarvitsee ilmoituksia varten.',
  },
  {
    title: 'Liitä Chat ID Tärppiin',
    body: 'Kopioi Chat ID sivuston kenttään. Sen jälkeen Tärppi tietää, mihin Telegram-viesti lähetetään.',
  },
  {
    title: 'Hae tapahtumat ja valitse seurattava',
    body: 'Valitse kaupunki, paina Hae tapahtumat tai liitä suora Kide.app-linkki. Listasta näet myös Tärpin arvion kiinnostavista tapahtumista.',
  },
  {
    title: 'Laita Tärppi vahtiin',
    body: 'Valitse lipputyyppi ja määrä. Jos myynti ei ole vielä alkanut, Tärppi odottaa oikeaa hetkeä ja yrittää koriin heti myynnin auettua.',
  },
  {
    title: 'Odota ilmoitusta',
    body: 'Kun liput menevät koriin, saat Telegramiin viestin. Maksu tehdään aina itse Kide.appissa.',
  },
]

export default function HowItWorksPage() {
  return (
    <>
      <SeoMeta
        title="Miten Tärppi toimii? - Kide.app lippubotti opiskelijoille"
        description="Avaa @Tarppibot, liitä Chat ID, valitse Kide.app-tapahtuma ja laita Tärppi vahtiin. Saat Telegramiin viestin, kun liput ovat korissa."
        path="/miten-toimii"
      />
      <StaticPageLayout
        kicker="Näin se menee"
        title="Miten Tärppi toimii?"
        lead="Tärppi seuraa Kide.app-tapahtumia puolestasi. Sinä valitset tapahtuman ja lipputyypin, Tärppi hoitaa vahdin."
      >
        <section className="seo-steps" aria-label="Käyttöönoton vaiheet">
          {steps.map((step, index) => (
            <article className="seo-step" key={step.title}>
              <span>{index + 1}</span>
              <div>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </div>
            </article>
          ))}
        </section>

        <section className="seo-band">
          <h2>Ei arvailua myynnin alussa</h2>
          <p>
            Moni opiskelijatapahtuma myy loppuun nopeasti. Tärppi pitää tilanteen näkyvillä ja yrittää valittua lipputyyppiä, kun myynti aukeaa tai lippuja vapautuu.
          </p>
          <Link className="simple-button simple-button--primary" to="/">Avaa Tärppi</Link>
        </section>
      </StaticPageLayout>
    </>
  )
}
