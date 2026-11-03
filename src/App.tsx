import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
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
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </div>
            <MergePrompt />
          </WalkWithUser>
        </SavesProvider>
      </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}
