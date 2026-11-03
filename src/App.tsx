import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ChooseDoor } from './screens/ChooseDoor'
import { Entrance } from './screens/Entrance'
import { FinalStretch } from './screens/FinalStretch'
import { Room } from './screens/Room'
import { SharePath } from './screens/SharePath'
import { YourPainting } from './screens/YourPainting'
import { WalkProvider } from './state/WalkContext'

export default function App() {
  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <WalkProvider>
        <div className="app-shell">
          <Routes>
            <Route path="/" element={<Entrance />} />
            <Route path="/room/:roomId" element={<Room />} />
            <Route path="/doors" element={<ChooseDoor />} />
            <Route path="/final" element={<FinalStretch />} />
            <Route path="/painting" element={<YourPainting />} />
            <Route path="/share" element={<SharePath />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </WalkProvider>
    </BrowserRouter>
  )
}
