import { Link } from 'react-router-dom'
import { SeoMeta } from './SeoMeta'
import { StaticPageLayout } from './StaticPageLayout'

const steps = [
  {
    title: 'Lisää Kide.app-token',
    body: 'Tärppi tarvitsee Kide.app-tokenin, jotta se voi lisätä liput juuri sinun koriisi. Token lisätään asetuksista ja sen toimivuus kannattaa tarkistaa heti.',
  },
  {
    title: 'Hae tapahtumat tai liitä linkki',
    body: 'Valitse kaupunki, paina Hae tapahtumat tai avaa yksittäinen Kide.app-tapahtuma suoralla linkillä. Tärppi näyttää myynnissä olevat ja tulossa olevat tapahtumat samassa listassa.',
  },
  {
    title: 'Valitse tapahtuma ja lipputyyppi',
    body: 'Avaa tapahtuma, valitse haluttu lipputyyppi ja määrä. Jos lipputyyppejä on useita, Tärppi yrittää niitä siinä järjestyksessä kuin olet valinnut.',
  },
  {
    title: 'Laita Tärppi vahtiin',
    body: 'Jos myynti ei ole vielä alkanut, Tärppi odottaa oikeaa hetkeä ja yrittää lisätä liput koriin heti myynnin auettua. Maksu tehdään aina itse Kide.appissa.',
  },
  {
    title: 'Lisää Telegram Chat ID halutessasi',
    body: 'Telegram ei ole pakollinen. Jos haluat ilmoitukset myös puhelimeen, avaa @Tarppibot, kirjoita /start ja liitä saamasi Chat ID Tärppiin.',
  },
]

export default function HowItWorksPage() {
  return (
    <>
      <SeoMeta
        title="Miten Tärppi seuraa Kide.app-lippuja? | Tärppi"
        description="Näin Tärppi seuraa Kide.app-lippujen myyntiä: token, tapahtuma, lipputyyppi, kori ja oma maksu Kide.appissa."
        path="/miten-toimii"
      />
      <StaticPageLayout
        kicker="Näin se menee"
        title="Miten Tärppi toimii?"
        lead="Tärppi seuraa Kide.app-lippujen myyntiä puolestasi. Tärkein asetus on Kide.app-token. Telegram Chat ID tarvitaan vain lisäilmoituksiin."
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
            Moni opiskelijatapahtuma myy loppuun nopeasti. Tärppi pitää tilanteen näkyvillä ja yrittää valittua lipputyyppiä, kun myynti aukeaa tai lippuja vapautuu. Kun liput ovat korissa, siirryt itse Kide.appiin maksamaan.
          </p>
          <Link className="simple-button simple-button--primary" to="/">Avaa Tärppi</Link>
        </section>
      </StaticPageLayout>
    </>
  )
}
