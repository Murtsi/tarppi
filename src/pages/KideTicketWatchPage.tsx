import { Link } from 'react-router-dom'
import { SeoMeta } from './SeoMeta'
import { StaticPageLayout } from './StaticPageLayout'

export default function KideTicketWatchPage() {
  return (
    <>
      <SeoMeta
        title="Kide.app-lippujen seuranta opiskelijatapahtumiin | Tärppi"
        description="Tärppi seuraa Kide.app-lippujen myyntiä approihin, sitseihin ja muihin opiskelijatapahtumiin. Valitse lipputyyppi, seuraa tilannetta ja maksa itse Kide.appissa."
        path="/kide-app-lippujen-seuranta"
      />
      <StaticPageLayout
        kicker="Lippujen seuranta"
        title="Kide.app-lippujen seuranta ilman jatkuvaa päivittämistä"
        lead="Suosittujen approjen, sitsien ja muiden opiskelijatapahtumien liput voivat mennä nopeasti. Tärppi pitää valitsemasi tapahtuman ja lipputyypin seurannassa."
      >
        <section className="seo-copy">
          <article>
            <h2>Valitse juuri se lipputyyppi</h2>
            <p>
              Avaa tapahtuma, valitse haluamasi lipputyyppi ja määrä. Jos haluat, voit asettaa useamman vaihtoehdon järjestykseen. Tärppi käy ne läpi siinä järjestyksessä kuin olet valinnut.
            </p>
          </article>
          <article>
            <h2>Seuranta alkaa ennen myyntiä</h2>
            <p>
              Kun myynti ei ole vielä auki, Tärppi odottaa oikeaa hetkeä. Myynnin alettua ohjelma yrittää lisätä valitut liput koriin. Telegram on vain vapaaehtoinen lisäilmoitus.
            </p>
          </article>
          <article>
            <h2>Maksu jää aina sinulle</h2>
            <p>
              Tärppi ei tee maksua eikä käsittele maksukorttitietoja. Varausyrityksen jälkeen avaat Kide.app-korin ja päätät itse, ostatko liput.
            </p>
          </article>
        </section>
        <section className="seo-band">
          <h2>Tarvitset vain tapahtuman ja tokenin</h2>
          <p>Jos tokenin rooli mietityttää, lue ensin token-opas. Siinä kerrotaan myös, mitä tietoja Tärppi ei pyydä.</p>
          <Link className="simple-button simple-button--primary" to="/kide-app-token">Lue token-opas</Link>
        </section>
      </StaticPageLayout>
    </>
  )
}
