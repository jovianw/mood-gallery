import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ChooseDoor } from './screens/ChooseDoor'
import { Entrance } from './screens/Entrance'
import { FinalStretch } from './screens/FinalStretch'
import { Finding } from './screens/Finding'
import { Room } from './screens/Room'
import { SharePath } from './screens/SharePath'
import { SharedWalk } from './screens/SharedWalk'
import { YourPainting } from './screens/YourPainting'
import { GuestAuthProvider } from './state/AuthContext'
import { GuestSavesProvider } from './state/SavesContext'
import { WalkProvider } from './state/WalkContext'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <GuestAuthProvider>
      <GuestSavesProvider>
        <WalkProvider>
          <div className="app-shell">
            <Routes>
              <Route path="/" element={<Entrance />} />
              <Route path="/room/:roomId" element={<Room />} />
              <Route path="/doors" element={<ChooseDoor />} />
              <Route path="/final" element={<FinalStretch />} />
              <Route path="/finding" element={<Finding />} />
              <Route path="/painting" element={<YourPainting />} />
              <Route path="/share" element={<SharePath />} />
              <Route path="/w/:shareId" element={<SharedWalk />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </WalkProvider>
      </GuestSavesProvider>
      </GuestAuthProvider>
    </BrowserRouter>
  )
}
