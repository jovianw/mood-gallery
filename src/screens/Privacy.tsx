import { Link } from 'react-router-dom'
import { Screen, TopAppBar } from '../components/ui'
import { useNav } from '../lib/nav'

const REPO = 'https://github.com/jovianw/mood-gallery'

/** Privacy notice and terms of use. Plain words, one page, linked from the entrance and the sign-in sheet. */
export function Privacy() {
  const nav = useNav()
  return (
    <Screen className="about">
      <TopAppBar
        eyebrow="Privacy and terms"
        title="What this site keeps, and what it does not"
        onLeft={() => (window.history.state?.idx > 0 ? nav.back() : nav.back('/'))}
      />
      <div className="gap-12" />
      <p className="about__p t-body--muted">Last updated November 4, 2026.</p>

      <h2 className="about__h">As a guest</h2>
      <p className="about__p">
        Nothing you answer leaves your device. Your walk, your answers and any paintings you save are kept in
        this browser's local storage so they survive a reload. Clearing the browser's site data removes them.
        We do not run analytics, advertising or tracking of any kind, and the site sets no cookies.
      </p>
      <p className="about__p">
        Two things do leave your device. Artwork images and, once per walk, the record of your matched work
        are fetched from The Metropolitan Museum of Art's public servers, which see your IP address the way
        any website you load does. The site itself is served by GitHub Pages, which keeps ordinary server
        logs under GitHub's own privacy statement.
      </p>

      <h2 className="about__h">If you sign in</h2>
      <p className="about__p">
        Signing in is optional. It exists only so your gallery follows you between devices. We use Google's
        Firebase for sign-in and storage. With a Google account we receive your name, email address and a
        user id; with an email link we receive your email address. We store, under your user id:
      </p>
      <ul className="about__list">
        <li>the paintings you save, with their public catalog details and the three mood words;</li>
        <li>one record per finished walk: the rooms visited, the mood vector, the painting's id and the time;</li>
        <li>share cards you create, which anyone with the link can view.</li>
      </ul>
      <p className="about__p">
        That is the whole list. We never see your password; Google handles the sign-in itself. Firebase keeps
        your session in this browser's local storage, not in a cookie. You can remove any saved painting from
        My Gallery at any time, and signing out ends the session on this device.
      </p>
      <p className="about__p">
        To delete your account and everything stored under it, open an issue at the project's{' '}
        <a href={`${REPO}/issues`} target="_blank" rel="noreferrer">GitHub repository</a> from the email address
        you signed in with, and it will be removed within a few days.
      </p>

      <h2 className="about__h">Terms of use</h2>
      <p className="about__p">
        Mood Gallery is a personal, non-commercial project. It is not affiliated with, endorsed by or
        connected to The Metropolitan Museum of Art. Artwork images and metadata come from The Met's Open
        Access program and are in the public domain under CC0; the museum's own{' '}
        <a href="https://www.metmuseum.org/policies/terms-and-conditions" target="_blank" rel="noreferrer">
          terms
        </a>{' '}
        govern their use.
      </p>
      <p className="about__p">
        The walk is a way of choosing a painting, not an assessment of you. The mood words and the match come
        from a statistical model described on the{' '}
        <Link to="/about" onClick={() => nav.markForward()}>method page</Link>; they are not psychological,
        medical or diagnostic advice, and should not be read as such.
      </p>
      <p className="about__p">
        The site is provided as is, without warranty. Gallery opening hours, locations and whether a work is on
        view come from the museum's public catalog and can be out of date; check with the museum before you
        travel. The code is open source at the{' '}
        <a href={REPO} target="_blank" rel="noreferrer">repository</a>.
      </p>
      <div className="gap-20" />
    </Screen>
  )
}
