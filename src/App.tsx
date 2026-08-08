import { Routes, Route } from 'react-router'
import { GamePage } from '@/components/game/GamePage'
import { GameErrorBoundary } from '@/components/game/GameErrorBoundary'

export default function App() {
  return (
    <GameErrorBoundary>
      <Routes>
        <Route path="/" element={<GamePage />} />
        <Route path="*" element={<GamePage />} />
      </Routes>
    </GameErrorBoundary>
  )
}
