import { Suspense, useEffect, useRef, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { isRoomId, rooms } from './data/rooms'
import { ErrorBoundary } from './components/ErrorBoundary'
import { MergeSheet } from './components/MergeSheet'
import { ChooseDoor } from './screens/ChooseDoor'
import { Entrance } from './screens/Entrance'
import { FinalStretch } from './screens/FinalStretch'
import { Finding } from './screens/Finding'
import { Gallery } from './screens/Gallery'
import { Room } from './screens/Room'
import { SharePath } from './screens/SharePath'
import { SharedWalk } from './screens/SharedWalk'
import { SavedPaintingScreen, YourPainting } from './screens/YourPainting'
import { useAuth } from './state/AuthContext'
import { AuthProvider } from './state/AuthProvider'
import { useSaves } from './state/SavesContext'
import { SavesProvider } from './state/SavesProvider'
import { WalkProvider } from './state/WalkContext'
import { lazyWithRetry } from './lib/lazy'

const About = lazyWithRetry(() => import('./screens/About').then((m) => ({ default: m.About })))
const Privacy = lazyWithRetry(() => import('./screens/Privacy').then((m) => ({ default: m.Privacy })))

/** The daily painting seed follows the account when there is one. */
function WalkWithUser({ children }: { children: ReactNode }) {
  const auth = useAuth()
  return <WalkProvider userId={auth.user?.uid}>{children}</WalkProvider>
}

/** After a sign-in, offer once to move guest saves into the account. */
function MergePrompt() {
  const saves = useSaves()
  if (!saves.pendingMergeCount) return null
  return (
    <MergeSheet
      count={saves.pendingMergeCount}
      onYes={() => void saves.mergeGuestSaves()}
      onNotNow={saves.declineMerge}
    />
  )
}

/** Document title for a path, so tabs, history and screen readers name the screen. */
function titleFor(pathname: string): string {
  const room = pathname.match(/^\/room\/([^/]+)/)?.[1]
  if (room && isRoomId(room)) return `${rooms[room].name} · Mood Gallery`
  const names: Record<string, string> = {
    '/': 'Mood Gallery',
    '/doors': 'Choose a door · Mood Gallery',
    '/final': 'The final stretch · Mood Gallery',
    '/finding': 'Finding your piece · Mood Gallery',
    '/painting': 'Your piece · Mood Gallery',
    '/share': 'Share your path · Mood Gallery',
    '/gallery': 'My Gallery · Mood Gallery',
    '/about': 'How it works · Mood Gallery',
    '/privacy': 'Privacy and terms · Mood Gallery',
  }
  if (names[pathname]) return names[pathname]
  if (pathname.startsWith('/gallery/')) return pathname.endsWith('/share') ? 'Share your path · Mood Gallery' : 'Saved piece · Mood Gallery'
  if (pathname.startsWith('/w/')) return 'A shared walk · Mood Gallery'
  return 'Mood Gallery'
}

/**
 * On every navigation: name the document after the screen and move focus to the new screen's
 * main landmark, so keyboard and screen-reader users land where the change happened instead of
 * at the top of a document that silently replaced itself. The first render is left alone.
 */
function RouteEffects() {
  const { pathname } = useLocation()
  const first = useRef(true)
  useEffect(() => {
    document.title = titleFor(pathname)
    if (first.current) {
      first.current = false
      return
    }
    const main = document.querySelector<HTMLElement>('main')
    if (!main) return
    main.setAttribute('tabindex', '-1')
    main.focus({ preventScroll: true })
  }, [pathname])
  return null
}

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <ErrorBoundary>
      <AuthProvider>
        <SavesProvider>
          <WalkWithUser>
            <div className="app-shell">
              <Routes>
                <Route path="/" element={<Entrance />} />
                <Route path="/room/:roomId" element={<Room />} />
                <Route path="/doors" element={<ChooseDoor />} />
                <Route path="/final" element={<FinalStretch />} />
                <Route path="/finding" element={<Finding />} />
                <Route path="/painting" element={<YourPainting />} />
                <Route path="/share" element={<SharePath />} />
                <Route path="/gallery" element={<Gallery />} />
                <Route path="/gallery/:objectID" element={<SavedPaintingScreen />} />
                <Route path="/gallery/:objectID/share" element={<SharePath />} />
                <Route path="/w/:shareId" element={<SharedWalk />} />
                <Route
                  path="/about"
                  element={
                    <Suspense fallback={<main className="screen" />}>
                      <About />
                    </Suspense>
                  }
                />
                <Route
                  path="/privacy"
                  element={
                    <Suspense fallback={<main className="screen" />}>
                      <Privacy />
                    </Suspense>
                  }
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              <RouteEffects />
            </div>
            <MergePrompt />
          </WalkWithUser>
        </SavesProvider>
      </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
