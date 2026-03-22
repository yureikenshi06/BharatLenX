import { useState, useMemo } from 'react'
import { THEME as T, colorPnL } from '../lib/theme'
import { fmt, fmtDate, fmtTime } from '../lib/data'
import { Card, SectionHead, Badge, Btn, Select } from '../components/UI'

const COLS = [
  { key: 'id',       label: '#',         width: 60  },
  { key: 'symbol',   label: 'Symbol',    width: 130 },
  { key: 'side',     label: 'Side',      width: 70  },
  { key: 'qty',      label: 'Qty',       width: 80  },
  { key: 'price',    label: 'Entry',     width: 90  },
  { key: 'exitPrice',label: 'Exit',      width: 90  },
  { key: 'leverage', label: 'Lev',       width: 55  },
  { key: 'pnl',      label: 'P&L',       width: 100 },
  { key: 'fee',      label: 'Fee',       width: 80  },
  { key: 'riskPercent',label: 'Risk%',   width: 65  },
  { key: 'equity',   label: 'Equity',    width: 100 },
  { key: 'time',     label: 'Date/Time', width: 160 },
]

export default function TradesPage({ trades }) {
  const [filterSym,  setFilterSym]  = useState('ALL')
  const [filterSide, setFilterSide] = useState('ALL')
  const [sortField,  setSortField]  = useState('time')
  const [sortDir,    setSortDir]    = useState('desc')
  const [search,     setSearch]     = useState('')
  const [page,       setPage]       = useState(0)
  const [selected,   setSelected]   = useState(null)
  const PER_PAGE = 30

  const symbols = useMemo(() => ['ALL', ...new Set(trades.map(t => t.symbol)).values()].sort(), [trades])

  const filtered = useMemo(() => trades
    .filter(t => filterSym  === 'ALL' || t.symbol === filterSym)
    .filter(t => filterSide === 'ALL' || t.side   === filterSide)
    .filter(t => !search || t.symbol.toLowerCase().includes(search.toLowerCase()) || t.id.includes(search))
    .sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1
      return typeof a[sortField] === 'string'
        ? a[sortField].localeCompare(b[sortField]) * dir
        : (a[sortField] - b[sortField]) * dir
    }), [trades, filterSym, filterSide, search, sortField, sortDir])

  const paged   = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE)
  const pages   = Math.ceil(filtered.length / PER_PAGE)
  const totPnL  = filtered.reduce((s, t) => s + t.pnl, 0)
  const totFees = filtered.reduce((s, t) => s + t.fee, 0)
  const winners = filtered.filter(t => t.pnl > 0).length

  const sortBy = (f) => { if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc'); else { setSortField(f); setSortDir('desc') } }

  return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 9, color: T.accent, letterSpacing: 3, textTransform: 'uppercase', marginBottom: 6 }}>Trade Log</div>
        <div style={{ fontSize: 30, fontWeight: 800, fontFamily: T.fontDisplay }}>All Trades</div>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
          placeholder="🔍 Search symbol or ID..."
          style={{ background: T.card, border: `1px solid ${T.border}`, borderRadius: 8, padding: '8px 14px', color: T.text, fontFamily: T.fontMono, fontSize: 12, width: 220, outline: 'none' }} />

        <Select value={filterSym}  onChange={v => { setFilterSym(v); setPage(0) }}
          options={symbols.map(s => ({ value: s, label: s === 'ALL' ? 'All Symbols' : s }))} />
        <Select value={filterSide} onChange={v => { setFilterSide(v); setPage(0) }}
          options={[{value:'ALL',label:'All Sides'},{value:'BUY',label:'BUY'},{value:'SELL',label:'SELL'}]} />
        <Select value={sortField} onChange={v => setSortField(v)}
          options={[{value:'time',label:'Sort: Time'},{value:'pnl',label:'Sort: PnL'},{value:'price',label:'Sort: Price'},{value:'qty',label:'Sort: Qty'},{value:'leverage',label:'Sort: Leverage'}]} />
        <Btn onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')}>
          {sortDir === 'desc' ? '↓ DESC' : '↑ ASC'}
        </Btn>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10 }}>
          <Btn variant="success" onClick={() => {
            const csv = ['id,symbol,side,qty,price,exitPrice,pnl,fee,leverage,duration,equity,time',
              ...filtered.map(t => `${t.id},${t.symbol},${t.side},${t.qty},${t.price},${t.exitPrice||''},${t.pnl},${t.fee},${t.leverage},${t.duration},${t.equity},${new Date(t.time).toISOString()}`)
            ].join('\n')
            const a = document.createElement('a'); a.href = 'data:text/csv,' + encodeURIComponent(csv); a.download = 'trades.csv'; a.click()
          }}>↓ Export CSV</Btn>
        </div>
      </div>

      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 14, padding: '10px 16px', background: T.surface, borderRadius: 10, border: `1px solid ${T.border}`, flexWrap: 'wrap' }}>
        {[
          { l: 'Showing',   v: filtered.length + ' trades' },
          { l: 'P&L',       v: (totPnL>=0?'+₹':'-₹')+fmt(Math.abs(totPnL)), c: colorPnL(totPnL) },
          { l: 'Fees',      v: '-₹'+fmt(totFees), c: T.red },
          { l: 'Win Rate',  v: fmt(winners/filtered.length*100)+'%', c: winners/filtered.length >= 0.5 ? T.green : T.red },
          { l: 'Winners',   v: winners, c: T.green },
          { l: 'Losers',    v: filtered.length - winners, c: T.red },
        ].map(r => (
          <div key={r.l} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: T.muted }}>{r.l}:</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: r.c || T.text }}>{r.v}</span>
            <span style={{ color: T.border }}>·</span>
          </div>
        ))}
      </div>

      {/* Table */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1100 }}>
            <thead>
              <tr style={{ background: T.surface, borderBottom: `2px solid ${T.border}` }}>
                {COLS.map(col => (
                  <th key={col.key}
                    onClick={() => sortBy(col.key)}
                    style={{
                      padding: '11px 14px', textAlign: 'left', cursor: 'pointer',
                      fontSize: 9, color: sortField === col.key ? T.accent : T.muted,
                      fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase',
                      whiteSpace: 'nowrap', userSelect: 'none',
                      fontFamily: T.fontMono,
                      width: col.width,
                    }}>
                    {col.label} {sortField === col.key ? (sortDir === 'desc' ? '↓' : '↑') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.map((tr, i) => {
                const isSelected = selected === tr.id
                return (
                  <tr
                    key={tr.id}
                    onClick={() => setSelected(isSelected ? null : tr.id)}
                    style={{
                      borderBottom: `1px solid ${T.border}`,
                      background: isSelected ? T.accentDim : i % 2 === 0 ? 'transparent' : T.surface + '66',
                      cursor: 'pointer',
                      transition: 'background 0.1s',
                    }}
                  >
                    <td style={{ padding: '9px 14px', fontSize: 11, color: T.muted }}>{tr.id}</td>
                    <td style={{ padding: '9px 14px', fontWeight: 700, fontSize: 13 }}>
                      {tr.symbol.replace('', '')}<span style={{ color: T.muted, fontSize: 10 }}>/USDT</span>
                    </td>
                    <td style={{ padding: '9px 14px' }}>
                      <Badge text={tr.side} color={tr.side === 'BUY' ? T.green : T.red} />
                    </td>
                    <td style={{ padding: '9px 14px', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{fmt(tr.qty, 4)}</td>
                    <td style={{ padding: '9px 14px', fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>${fmt(tr.price)}</td>
                    <td style={{ padding: '9px 14px', fontVariantNumeric: 'tabular-nums', fontSize: 12, color: T.muted }}>${fmt(tr.exitPrice)}</td>
                    <td style={{ padding: '9px 14px', fontSize: 11 }}>
                      <span style={{ color: tr.leverage >= 10 ? T.red : tr.leverage >= 5 ? T.accent : T.textMid }}>{tr.leverage}x</span>
                    </td>
                    <td style={{ padding: '9px 14px', fontWeight: 800, fontSize: 13, color: colorPnL(tr.pnl), fontVariantNumeric: 'tabular-nums' }}>
                      {tr.pnl >= 0 ? '+' : ''}{fmt(tr.pnl)}
                    </td>
                    <td style={{ padding: '9px 14px', fontSize: 11, color: T.red }}>-${fmt(tr.fee, 4)}</td>
                    <td style={{ padding: '9px 14px', fontSize: 11, color: tr.riskPercent > 2 ? T.red : T.textMid }}>{fmt(tr.riskPercent, 2)}%</td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: T.textMid, fontVariantNumeric: 'tabular-nums' }}>${fmt(tr.equity)}</td>
                    <td style={{ padding: '9px 14px', fontSize: 11, color: T.muted, whiteSpace: 'nowrap' }}>
                      {fmtDate(tr.time)} <span style={{ color: T.border }}>·</span> {fmtTime(tr.time)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 }}>
        <div style={{ fontSize: 11, color: T.muted }}>
          Page {page+1} of {pages} · {filtered.length} trades
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <Btn onClick={() => setPage(0)} disabled={page === 0}>«</Btn>
          <Btn onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}>‹ Prev</Btn>
          {Array.from({ length: Math.min(5, pages) }, (_, i) => {
            const pg = Math.max(0, Math.min(pages-5, page-2)) + i
            return (
              <Btn key={pg} onClick={() => setPage(pg)}
                variant={pg === page ? 'accent' : 'default'}
                style={{ minWidth: 36 }}>{pg+1}</Btn>
            )
          })}
          <Btn onClick={() => setPage(p => Math.min(pages-1, p+1))} disabled={page >= pages-1}>Next ›</Btn>
          <Btn onClick={() => setPage(pages-1)} disabled={page >= pages-1}>»</Btn>
        </div>
      </div>
    </div>
  )
}
