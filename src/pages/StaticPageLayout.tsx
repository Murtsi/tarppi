import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { TarppiMark } from '../components/Logo'

type StaticPageLayoutProps = {
  kicker: string
  title: string
  lead: string
  children: ReactNode
}

export function StaticPageLayout({ kicker, title, lead, children }: StaticPageLayoutProps) {
  return (
    <div className="simple-app seo-page">
      <header className="simple-top seo-top">
        <Link className="simple-brand seo-brand" to="/">
          <span className="simple-brand__mark"><TarppiMark size={38} /></span>
          <div>
            <h1>Tärppi</h1>
            <p>Kide.app-ohjelma opiskelijoille</p>
          </div>
        </Link>
        <nav className="seo-nav" aria-label="Sivut">
          <Link to="/miten-toimii">Miten toimii</Link>
          <Link to="/ukk">UKK</Link>
          <Link to="/tietoa">Tietoa</Link>
          <Link className="simple-button simple-button--primary" to="/">Avaa Tärppi</Link>
        </nav>
      </header>

      <main className="seo-shell">
        <section className="seo-hero">
          <span className="simple-kicker">{kicker}</span>
          <h2>{title}</h2>
          <p>{lead}</p>
        </section>
        {children}
      </main>

      <footer className="simple-footer seo-footer">
        <span>Tärppi - opiskelijoiden tekemä Kide.app-työkalu</span>
        <span>
          <Link to="/miten-toimii">Miten toimii</Link>
          {' '}·{' '}
          <Link to="/ukk">UKK</Link>
          {' '}·{' '}
          <Link to="/tietoa">Tietoa</Link>
          {' '}·{' '}
          <a href="https://github.com/Murtsi/Kidehiiri-public" target="_blank" rel="noreferrer">GitHub</a>
          {' '}· Epävirallinen työkalu, ei Kide.appin tuottama
        </span>
      </footer>
    </div>
  )
}
