// ── Fyers CSV Auto-Detector & Parser ─────────────────────────────────────────
// Handles: Tradebook (best), Orderbook, Global PnL (instrument summary), Ledger
// Tradebook is the recommended file — has Symbol, Date, Side, Qty, Traded price, Segment

function cleanNum(v) {
  return parseFloat(String(v || '0').replace(/,/g, '').trim()) || 0
}
function cleanId(v) {
  return String(v || '').replace(/[="]/g, '').replace(/\s/g, '').trim()
}

// ── Detect which Fyers report type ───────────────────────────────────────────
export function detectFileType(text) {
  if (text.includes('Tradebook Report'))  return 'tradebook'
  if (text.includes('Orderbook Report'))  return 'orderbook'
  if (text.includes('Global_pnl Report')) return 'global_pnl'
  if (text.includes('Ledger Report'))     return 'ledger'
  return 'unknown'
}

// ── Parse CSV lines into objects, skipping metadata header ───────────────────
function parseCSVLines(text) {
  const lines = text.split('\n')
  // Find the data header — first line where first cell doesn't look like metadata
  let headerIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim()
    if (!l) continue
    // Header rows contain column names — look for typical Fyers column names
    if (/^(Symbol|Name|Date|Narration|Transaction)/i.test(l)) {
      headerIdx = i; break
    }
  }
  if (headerIdx === -1) return { headers: [], rows: [] }

  const parseRow = (line) => {
    const res = []; let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { inQ = !inQ }
      else if (c === ',' && !inQ) { res.push(cur.trim()); cur = '' }
      else cur += c
    }
    res.push(cur.trim())
    return res.map(v => v.replace(/^"|"$/g, '').trim())
  }

  const headers = parseRow(lines[headerIdx]).map(h => h.trim())
  const rows = []
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    const cols = parseRow(line)
    const row = {}
    headers.forEach((h, j) => { row[h] = (cols[j] || '').trim() })
    rows.push(row)
  }
  return { headers, rows }
}

// ── Parse date from Tradebook: "15 Oct 2024, 09:46:50 AM" ────────────────────
function parseTradeDate(str) {
  if (!str) return Date.now()
  // "15 Oct 2024, 09:46:50 AM" → parse as IST
  const m = str.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4}),?\s+(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)?/i)
  if (m) {
    const months = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 }
    let h = parseInt(m[4])
    if (m[7]?.toUpperCase() === 'PM' && h !== 12) h += 12
    if (m[7]?.toUpperCase() === 'AM' && h === 12) h = 0
    // Create as IST (+5:30)
    const d = new Date(Date.UTC(parseInt(m[3]), months[m[2]] ?? 0, parseInt(m[1]), h - 5, parseInt(m[5]) - 30, parseInt(m[6])))
    return isNaN(d.getTime()) ? Date.now() : d.getTime()
  }
  // Fallback: "15-10-2024 09:27:41"
  const m2 = str.match(/(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/)
  if (m2) {
    const d = new Date(`${m2[3]}-${m2[2]}-${m2[1]}T${m2[4]}:${m2[5]}:${m2[6]}+05:30`)
    return isNaN(d.getTime()) ? Date.now() : d.getTime()
  }
  const ts = Date.parse(str)
  return isNaN(ts) ? Date.now() : ts
}

// ── Detect segment from symbol ────────────────────────────────────────────────
function detectSegment(sym, segmentHint) {
  if (segmentHint) {
    const s = segmentHint.toLowerCase()
    if (s.includes('deriv') || s.includes('fno') || s.includes('f&o')) {
      if (/CE$|PE$/.test(sym)) return 'options'
      return 'futures'
    }
    if (s.includes('equity') || s.includes('cash')) return 'equity'
  }
  if (/CE$|PE$/.test(sym)) return 'options'
  if (/FUT$/.test(sym)) return 'futures'
  return 'equity'
}

// ── FIFO P&L calculator ───────────────────────────────────────────────────────
function calcFifoPnL(trades) {
  const queues = {}
  const result = []
  for (const t of trades) {
    const key = `${t.symbol}|${t.productType}`
    if (!queues[key]) queues[key] = []
    if (t.side === 'BUY') {
      queues[key].push({ price: t.price, qty: t.qty })
      result.push({ ...t, pnl: 0 })
    } else {
      let remaining = t.qty, cost = 0, matched = 0
      while (remaining > 0 && queues[key].length > 0) {
        const buy = queues[key][0]
        const m = Math.min(remaining, buy.qty)
        cost += buy.price * m; matched += m
        remaining -= m; buy.qty -= m
        if (buy.qty <= 0) queues[key].shift()
      }
      const avgBuy = matched > 0 ? cost / matched : t.price
      result.push({ ...t, pnl: +((t.price - avgBuy) * matched).toFixed(2) })
    }
  }
  return result
}

// ── Build equity curve ────────────────────────────────────────────────────────
function buildCurve(trades) {
  let eq = 100000
  return trades.map(t => { eq = +(eq + t.pnl - t.fee).toFixed(2); return { ...t, equity: eq } })
}

// ═════════════════════════════════════════════════════════════════════════════
// TRADEBOOK PARSER — RECOMMENDED (Symbol, Date & time, Side, Qty, Traded price, Segment)
// ═════════════════════════════════════════════════════════════════════════════
function parseTradebook(text) {
  const { rows } = parseCSVLines(text)
  const trades = []
  for (const r of rows) {
    const qty   = cleanNum(r['Qty'])
    const price = cleanNum(r['Traded price'])
    if (!qty || !price) continue
    const sym   = (r['Symbol'] || '').replace(/^(NSE:|BSE:|NFO:|MCX:)/,'').trim()
    if (!sym) continue
    const fid   = cleanId(r['FYERS order ID'] || r['OMS order ID'] || '')
    const exid  = cleanId(r['Exchange order ID'] || '')
    const id    = fid || exid || `${sym}_${Date.now()}_${Math.random().toString(36).slice(2,5)}`
    const time  = parseTradeDate(r['Date & time'] || r['Date & Time'] || '')
    const seg   = detectSegment(sym, r['Segment'] || '')
    const prod  = (r['Product type'] || 'INTRADAY').trim()
    let productType = 'INTRADAY'
    if (/delivery|cnc/i.test(prod)) productType = 'CNC'
    else if (/overnight|nrml/i.test(prod)) productType = 'NRML'
    trades.push({
      id: `tb_${id}`, symbol: sym, segment: seg,
      side: r['Side']?.toUpperCase() === 'BUY' ? 'BUY' : 'SELL',
      qty, price: +price.toFixed(2), exitPrice: +price.toFixed(2),
      pnl: 0, fee: 0, equity: 100000,
      time, exchange: seg === 'equity' ? 'NSE' : 'NFO',
      productType, source: 'csv', rawId: id,
    })
  }
  trades.sort((a,b) => a.time - b.time)
  return buildCurve(calcFifoPnL(trades))
}

// ═════════════════════════════════════════════════════════════════════════════
// ORDERBOOK PARSER — fallback (Symbol, Date & Time, Side, Qty, Traded price)
// ═════════════════════════════════════════════════════════════════════════════
function parseOrderbook(text) {
  const { rows } = parseCSVLines(text)
  const trades = []
  for (const r of rows) {
    if (r['Status']?.trim() !== 'Executed') continue
    const qty   = cleanNum(r['Qty'])
    const price = cleanNum(r['Traded price'])
    if (!qty || !price) continue
    const rawSym = (r['Symbol'] || '').trim()
    const sym    = rawSym.replace(/^(NSE:|BSE:|NFO:|MCX:)/,'').trim()
    if (!sym) continue
    const omsId = cleanId(r['OMS order ID'] || '')
    const exId  = cleanId(r['Exchange order ID'] || '')
    const id    = omsId || exId || `${sym}_${Date.now()}_${Math.random().toString(36).slice(2,5)}`
    const time  = parseTradeDate(r['Date & Time'] || r['Date & time'] || '')
    const seg   = detectSegment(sym, '')
    let productType = 'INTRADAY'
    if (/delivery|cnc/i.test(r['Product type']||'')) productType = 'CNC'
    else if (/overnight|nrml/i.test(r['Product type']||'')) productType = 'NRML'
    trades.push({
      id: `ob_${id}`, symbol: sym, segment: seg,
      side: r['Side']?.toUpperCase() === 'BUY' ? 'BUY' : 'SELL',
      qty, price: +price.toFixed(2), exitPrice: +price.toFixed(2),
      pnl: 0, fee: 0, equity: 100000,
      time, exchange: rawSym.startsWith('BSE:') ? 'BSE' : seg === 'equity' ? 'NSE' : 'NFO',
      productType, source: 'csv', rawId: id,
    })
  }
  trades.sort((a,b) => a.time - b.time)
  return buildCurve(calcFifoPnL(trades))
}

// ═════════════════════════════════════════════════════════════════════════════
// GLOBAL PnL PARSER — instrument-level realized P&L (no individual trades)
// Returns summary objects, not trade-by-trade
// ═════════════════════════════════════════════════════════════════════════════
export function parseGlobalPnL(text) {
  const { rows } = parseCSVLines(text)
  // Also extract summary from metadata
  const lines = text.split('\n')
  const getMeta = (key) => {
    for (const l of lines) {
      if (l.startsWith(key + ',')) {
        return cleanNum(l.split(',').slice(1).join(','))
      }
    }
    return 0
  }
  const summary = {
    netPnL:       getMeta('Net P&L'),
    grossPnL:     getMeta('Gross P&L'),
    totalCharges: getMeta('Total charges'),
    brokerage:    getMeta('Brokerage'),
    stt:          getMeta('STT'),
    exchangeTxn:  getMeta('Exchange transacation'),
    gst:          getMeta('GST'),
    stampDuty:    getMeta('Stamp duty'),
  }
  const instruments = rows
    .filter(r => r['Name'] && r['Realised P&L'])
    .map(r => ({
      name:     (r['Name'] || '').replace(/^(NSE:|BSE:|NFO:)/,'').trim(),
      pnl:      cleanNum(r['Realised P&L']),
      segment:  /deriv/i.test(r['Segment']||'') ? (/CE$|PE$/.test(r['Name']||'') ? 'options' : 'futures') : 'equity',
      buyQty:   cleanNum(r['Buy qty']),
      buyPrice: cleanNum(r['Buy price']),
      sellQty:  cleanNum(r['Sell qty']),
      sellPrice:cleanNum(r['Sell price']),
    }))
  return { type: 'global_pnl', summary, instruments }
}

// ═════════════════════════════════════════════════════════════════════════════
// LEDGER PARSER — capital flow (deposits / withdrawals)
// ═════════════════════════════════════════════════════════════════════════════
export function parseLedger(text) {
  const { rows } = parseCSVLines(text)
  const lines = text.split('\n')
  const getMeta = (key) => {
    for (const l of lines) {
      if (l.startsWith(key + ',')) return cleanNum(l.split(',').slice(1).join(','))
    }
    return 0
  }
  const summary = {
    fundsAdded:     getMeta('Funds Added'),
    fundsWithdrawn: getMeta('Funds Withdrawn'),
    openingBalance: getMeta('Opening Balance'),
    closingBalance: getMeta('Closing Balance'),
  }
  // Parse individual transactions
  const transactions = []
  for (const r of rows) {
    const txType = (r['Transaction type'] || '').toLowerCase()
    if (txType === 'funds added' || txType === 'funds received') {
      transactions.push({
        id:     `ledger_${r['Date']?.replace(/\s/g,'_')}_in_${Math.random().toString(36).slice(2,5)}`,
        type:   'deposit',
        amount: cleanNum(r['Credit amount']),
        date:   r['Date'] || '',
        note:   r['Description'] || 'Funds added',
        time:   Date.parse(r['Date'] || '') || Date.now(),
      })
    } else if (txType === 'funds withdrawn' || txType === 'funds withdrawal') {
      transactions.push({
        id:     `ledger_${r['Date']?.replace(/\s/g,'_')}_out_${Math.random().toString(36).slice(2,5)}`,
        type:   'withdrawal',
        amount: cleanNum(r['Debit amount']),
        date:   r['Date'] || '',
        note:   r['Description'] || 'Funds withdrawn',
        time:   Date.parse(r['Date'] || '') || Date.now(),
      })
    }
  }
  return { type: 'ledger', summary, transactions }
}

// ═════════════════════════════════════════════════════════════════════════════
// MAIN ENTRY — auto-detect and parse
// ═════════════════════════════════════════════════════════════════════════════
export function parseFyersFile(text, filename = '') {
  const fileType = detectFileType(text)

  if (fileType === 'tradebook') {
    const trades = parseTradebook(text)
    return { type: 'tradebook', trades, count: trades.length }
  }
  if (fileType === 'orderbook') {
    const trades = parseOrderbook(text)
    return { type: 'orderbook', trades, count: trades.length }
  }
  if (fileType === 'global_pnl') {
    return parseGlobalPnL(text)
  }
  if (fileType === 'ledger') {
    return parseLedger(text)
  }

  // If we can't detect, try parsing as tradebook then orderbook
  if (text.includes('Traded price') && text.includes('Date & time')) {
    const trades = parseTradebook(text)
    if (trades.length) return { type: 'tradebook', trades, count: trades.length }
  }
  if (text.includes('Traded price') && text.includes('Date & Time')) {
    const trades = parseOrderbook(text)
    if (trades.length) return { type: 'orderbook', trades, count: trades.length }
  }
  throw new Error(`Could not identify file type. Please upload a Fyers Tradebook, Orderbook, Global P&L, or Ledger CSV.`)
}
