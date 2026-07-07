import { Link } from 'react-router-dom'
import { SeoMeta } from './SeoMeta'
import { StaticPageLayout } from './StaticPageLayout'

export default function AboutPage() {
  return (
    <>
      <SeoMeta
        title="Tietoa Tärpistä - Kide.app seuranta opiskelijoille"
        description="Tärppi on opiskelijoiden tekemä ilmainen työkalu Kide.app-tapahtumien seurantaan. Saat Telegramiin tiedon, kun liput ovat korissa."
        path="/tietoa"
      />
      <StaticPageLayout
        kicker="Tietoa"
        title="Tietoa Tärpistä"
        lead="Tärppi syntyi aika arkisesta ongelmasta: hyvät opiskelijatapahtumat menevät nopeasti, eikä kukaan jaksa päivittää Kide.appia koko iltaa."
      >
        <section className="seo-copy">
          <article>
            <h2>Mikä on Tärppi?</h2>
            <p>
              Tärppi on ilmainen Kide.app-seurantatyökalu opiskelijoille. Valitset tapahtuman, lipputyypin ja määrän. Tärppi vahtii tilannetta ja ilmoittaa Telegramissa, kun liput ovat korissa.
            </p>
          </article>

          <article>
            <h2>Miksi teimme Tärpin?</h2>
            <p>
              Sitsit, approt ja muut suositut opiskelijatapahtumat voivat mennä hetkessä. Jatkuva päivittäminen on rasittavaa, varsinkin jos myynti alkaa kesken luennon tai työvuoron. Tärppi tekee vahdista automaattisen.
            </p>
          </article>

          <article>
            <h2>Tekniikka</h2>
            <p>
              Käyttöliittymä on tehty Reactilla ja TypeScriptillä. Taustalla on Railwaylla ajettava backend, Telegram Bot API ja Kide.appin tapahtumatietoja lukevat integraatiot.
            </p>
          </article>

          <article>
            <h2>Vastuuvapauslauseke</h2>
            <p>
              Tärppi on epävirallinen työkalu. Se ei ole Kide.appin tuote, eikä Kide.app vastaa Tärpin toiminnasta.
            </p>
          </article>
        </section>

        <section className="seo-band">
          <h2>Valmis kokeilemaan?</h2>
          <p>Lisää Telegram Chat ID, valitse tapahtuma ja laita Tärppi vahtiin.</p>
          <Link className="simple-button simple-button--primary" to="/">Avaa Tärppi</Link>
        </section>
      </StaticPageLayout>
    </>
  )
}
