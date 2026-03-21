import { useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useTrades } from './hooks/useTrades'
import Layout from './components/Layout'
import LoginPage    from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import TradesPage   from './pages/TradesPage'
import AnalyticsPage from './pages/AnalyticsPage'
import CalendarPage  from './pages/CalendarPage'
import SymbolsPage   from './pages/SymbolsPage'
import WalletPage    from './pages/WalletPage'
import ProgressPage  from './pages/ProgressPage'
import EODPage       from './pages/EODPage'
import ChecklistPage from './pages/ChecklistPage'
import NotesPage     from './pages/NotesPage'
import AIPage        from './pages/AIPage'
import ShareCardPage from './pages/ShareCardPage'
import SettingsPage  from './pages/SettingsPage'

function AppInner() {
  const { user, loading } = useAuth()
  const [page, setPage] = useState('dashboard')

  const {
    trades, allTrades, stats, activeStats, loading: tradesLoading,
    connected, source, error, progress, dateRange, savedKeys, segment,
    setSegment, loadDemo, connectFyers, applyDateRange, disconnectFyers,
  } = useTrades()

  if (loading) return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#03050c', color:'#3a527a', fontFamily:'DM Sans,sans-serif', fontSize:13 }}>
      <div>Loading...</div>
    </div>
  )

  // Require auth — remove this if you want no-auth mode
  // if (!user) return <LoginPage/>

  const pageProps = { trades, allTrades, stats, activeStats, segment, setSegment, applyDateRange, dateRange }

  const renderPage = () => {
    switch(page) {
      case 'dashboard': return <DashboardPage {...pageProps}/>
      case 'trades':    return <TradesPage trades={trades}/>
      case 'charts':    return <AnalyticsPage trades={trades} stats={activeStats}/>
      case 'calendar':  return <CalendarPage  trades={allTrades} stats={stats.all||{}}/>
      case 'symbols':   return <SymbolsPage   trades={trades} stats={activeStats}/>
      case 'wallet':    return <WalletPage    trades={allTrades} stats={stats.all||{}}/>
      case 'progress':  return <ProgressPage  trades={trades} stats={activeStats}/>
      case 'eod':       return <EODPage       trades={allTrades} stats={stats.all||{}}/>
      case 'checklist': return <ChecklistPage/>
      case 'notes':     return <NotesPage     trades={allTrades}/>
      case 'ai':        return <AIPage        trades={trades} stats={activeStats}/>
      case 'share':     return <ShareCardPage trades={allTrades} stats={stats}/>
      case 'settings':  return (
        <SettingsPage
          trades={trades} stats={stats.all} activeStats={activeStats}
          onConnectFyers={connectFyers} onLoadDemo={loadDemo}
          onDisconnect={disconnectFyers}
          source={source} error={error} progress={progress} savedKeys={savedKeys}
        />
      )
      default: return <DashboardPage {...pageProps}/>
    }
  }

  return (
    <Layout activePage={page} onPageChange={setPage} connected={connected} source={source} trades={allTrades}>
      {renderPage()}
    </Layout>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner/>
    </AuthProvider>
  )
}
