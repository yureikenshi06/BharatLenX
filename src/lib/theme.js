// MarketLens — Indian F&O & Swing Trading Journal
// Deep navy institutional aesthetic — Bloomberg terminal meets Dalal Street
export const THEME = {
  bg:         '#050810',
  bgDeep:     '#03050c',
  surface:    '#080c1a',
  card:       '#0b1020',
  cardHover:  '#0f1528',
  border:     '#182040',
  borderMid:  '#1e2a54',
  text:       '#dde4f5',
  textMid:    '#7b9ac8',
  muted:      '#3a527a',
  // Bright blue accent — NSE terminal feel
  accent:     '#4f8fff',
  accentDim:  'rgba(79,143,255,0.12)',
  accentGlow: 'rgba(79,143,255,0.22)',
  // Indian market colours
  green:      '#00d68f',
  greenDim:   'rgba(0,214,143,0.10)',
  red:        '#ff4d6a',
  redDim:     'rgba(255,77,106,0.10)',
  blue:       '#4f8fff',
  blueDim:    'rgba(79,143,255,0.10)',
  purple:     '#9d7fff',
  purpleDim:  'rgba(157,127,255,0.10)',
  cyan:       '#00d4ff',
  cyanDim:    'rgba(0,212,255,0.10)',
  orange:     '#ff8c42',
  orangeDim:  'rgba(255,140,66,0.10)',
  // Segment colours
  equityColor:  '#4f8fff',
  optionColor:  '#9d7fff',
  futureColor:  '#00d4ff',
  // Typography
  fontDisplay: "'DM Sans', 'Plus Jakarta Sans', -apple-system, sans-serif",
  fontMono:    "'JetBrains Mono', 'Fira Code', monospace",
  fontSans:    "'DM Sans', 'Plus Jakarta Sans', -apple-system, sans-serif",
}

export const colorPnL    = (n) => n >= 0 ? THEME.green : THEME.red
export const bgPnL       = (n) => n >= 0 ? THEME.greenDim : THEME.redDim
export const segmentColor = (seg) => ({ equity: THEME.equityColor, options: THEME.optionColor, futures: THEME.futureColor })[seg] || THEME.accent
