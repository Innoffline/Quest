import { lazy, Suspense } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { ErrorNote, Loading } from './components/ui'
import { HistoryScreen } from './screens/HistoryScreen'
import { LoginScreen } from './screens/LoginScreen'
import { PlanScreen } from './screens/PlanScreen'
import { QuestScreen } from './screens/QuestScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TodayScreen } from './screens/TodayScreen'
import { AppProvider, useApp } from './state/AppContext'

// Charts are the heaviest dependency; load them only when Review opens.
const ReviewScreen = lazy(() => import('./screens/ReviewScreen'))

function Gate() {
  const { auth, error } = useApp()
  if (auth === 'loading')
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loading label="Loading quests" />
      </div>
    )
  if (auth === 'signed-out') return <LoginScreen />
  if (auth === 'error')
    return (
      <div className="p-6">
        <ErrorNote message={error ?? 'Unknown error'} />
        <p className="mt-4 text-sm text-muted">If this is a fresh Supabase project, check that the migration in supabase/migrations has been applied.</p>
      </div>
    )
  return (
    <AppShell>
      <Suspense fallback={<div className="p-4"><Loading /></div>}>
        <Routes>
          <Route path="/" element={<TodayScreen />} />
          <Route path="/plan" element={<PlanScreen />} />
          <Route path="/quest/:id" element={<QuestScreen />} />
          <Route path="/history" element={<HistoryScreen />} />
          <Route path="/review" element={<ReviewScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppShell>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <Gate />
      </AppProvider>
    </BrowserRouter>
  )
}
