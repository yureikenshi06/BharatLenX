import { useState } from 'react'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { useTrades } from './hooks/useTrades'
import Layout        from './components/Layout'
import DashboardPage from './pages/DashboardPage'
import TradesPage    from './pages/TradesPage'
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
  const [page, setPage]   = useState('dashboard')

  const {
    trades, allTrades, stats, activeStats, loading: tradesLoading, syncing,
    connected, source, error, progress, dateRange, tokenInfo, segment,
    fyersConnected, syncStatus,
    setSegment, connectFyers, pasteToken, manualSync, applyDateRange, disconnectFyers,
  } = useTrades()

  if (loading || tradesLoading) return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', background:'#03050c', fontFamily:'DM Sans,sans-serif', gap:12 }}>
      <div style={{ fontSize:28, color:'#4f8fff' }}>◈</div>
      <div style={{ fontSize:13, color:'#3a527a' }}>
        {progress || 'Loading BharatLenX...'}
      </div>
      {progress && (
        <div style={{ fontSize:11, color:'#182040', maxWidth:320, textAlign:'center', lineHeight:1.6 }}>{progress}</div>
      )}
    </div>
  )

  const pageProps = { trades, allTrades, stats, activeStats, segment, setSegment, applyDateRange, dateRange, fyersConnected }

  const renderPage = () => {
    switch (page) {
      case 'dashboard': return <DashboardPage {...pageProps}/>
      case 'trades':    return <TradesPage trades={trades}/>
      case 'charts':    return <AnalyticsPage trades={trades} stats={activeStats}/>
      case 'calendar':  return <CalendarPage  trades={allTrades} stats={stats.all||{}}/>
      case 'symbols':   return <SymbolsPage   trades={trades}    stats={activeStats}/>
      case 'wallet':    return <WalletPage    trades={allTrades} stats={stats.all||{}}/>
      case 'progress':  return <ProgressPage  trades={trades}    stats={activeStats}/>
      case 'eod':       return <EODPage       trades={allTrades} stats={stats.all||{}}/>
      case 'checklist': return <ChecklistPage/>
      case 'notes':     return <NotesPage trades={allTrades}/>
      case 'ai':        return <AIPage    trades={trades} stats={activeStats}/>
      case 'share':     return <ShareCardPage trades={allTrades} stats={stats}/>
      case 'settings':  return (
        <SettingsPage
          trades={trades} activeStats={activeStats}
          onConnect={connectFyers} onPasteToken={pasteToken}
          onManualSync={manualSync} onDisconnect={disconnectFyers}
          source={source} error={error} progress={progress} syncing={syncing}
          tokenInfo={tokenInfo} fyersConnected={fyersConnected} syncStatus={syncStatus}
        />
      )
      default: return <DashboardPage {...pageProps}/>
    }
  }

  return (
    <Layout activePage={page} onPageChange={setPage} connected={connected} source={source} trades={allTrades}>
      {/* Sync indicator — subtle top bar when background sync is running */}
      {syncing && source === 'fyers' && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: 2, zIndex: 1000,
          background: `linear-gradient(90deg, #4f8fff, #00d4ff, #9d7fff, #4f8fff)`,
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.4s ease-in-out infinite',
        }}/>
      )}
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
