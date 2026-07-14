import { Link } from 'react-router-dom'
import { SeoMeta } from './SeoMeta'
import { StaticPageLayout } from './StaticPageLayout'

export default function KideTokenGuidePage() {
  return (
    <>
      <SeoMeta
        title="Kide.app-token: mitä se on ja miten sitä käytetään? | Tärppi"
        description="Kide.app-token tarvitaan, kun Tärppi lisää valitsemasi liput koriin. Lue mitä token tekee, miten sitä käytetään ja mitä tietoja Tärppi ei pyydä."
        path="/kide-app-token"
      />
      <StaticPageLayout
        kicker="Token-opas"
        title="Mikä Kide.app-token on?"
        lead="Token on Kide.app-kirjautumisesi tunniste. Tärppi tarvitsee sen vain silloin, kun ohjelman pitää lisätä valitsemasi liput juuri sinun koriisi."
      >
        <section className="seo-copy">
          <article>
            <h2>Token ei ole salasana</h2>
            <p>
              Tärppiin ei kirjoiteta Kide.app-salasanaa eikä maksukorttitietoja. Token on kirjautuneesta Kide.app-istunnosta saatava tunniste, jolla palvelu tunnistaa korin oikeaksi.
            </p>
          </article>
          <article>
            <h2>Mihin Tärppi käyttää tokenia?</h2>
            <p>
              Tokenilla tarkistetaan, että yhteys toimii, ja tehdään valitsemasi lipputyypin varausyritys. Tärppi ei maksa lippuja. Kun liput ovat korissa, viimeistelet maksun itse Kide.appissa.
            </p>
          </article>
          <article>
            <h2>Pidä token omana tietonasi</h2>
            <p>
              Token kannattaa käsitellä kuin kirjautumistietoa: älä lähetä sitä viestillä, älä lisää sitä GitHubiin ja poista se selaimesta, jos käytät yhteistä konetta. Tärppi säilyttää tokenin vain selaimen istunnon ajan.
            </p>
          </article>
        </section>
        <section className="seo-band">
          <h2>Kun token on lisätty</h2>
          <p>Valitse tapahtuma ja lipputyyppi. Sen jälkeen voit laittaa Tärpin seuraamaan myynnin avautumista tai lippujen vapautumista.</p>
          <Link className="simple-button simple-button--primary" to="/">Avaa Tärppi</Link>
        </section>
      </StaticPageLayout>
    </>
  )
}
