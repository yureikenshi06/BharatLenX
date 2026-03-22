// BharatLenX — Black & Blue theme (deep black base, sharp blue accents)
export const THEME = {
  bg:         '#000000',
  bgDeep:     '#000000',
  surface:    '#050508',
  card:       '#080810',
  cardHover:  '#0c0c18',
  border:     '#0f1630',
  borderMid:  '#162040',
  text:       '#e8eeff',
  textMid:    '#5a7ab0',
  muted:      '#2a3a5c',
  // Electric blue accent — sharp, not washed out
  accent:     '#2979ff',
  accentDim:  'rgba(41,121,255,0.10)',
  accentGlow: 'rgba(41,121,255,0.18)',
  // P&L colours
  green:      '#00e676',
  greenDim:   'rgba(0,230,118,0.09)',
  red:        '#ff1744',
  redDim:     'rgba(255,23,68,0.09)',
  // Segment / chart colours
  blue:       '#2979ff',
  blueDim:    'rgba(41,121,255,0.09)',
  purple:     '#7c4dff',
  purpleDim:  'rgba(124,77,255,0.09)',
  cyan:       '#00b0ff',
  cyanDim:    'rgba(0,176,255,0.09)',
  orange:     '#ff6d00',
  orangeDim:  'rgba(255,109,0,0.09)',
  // Segment
  equityColor: '#2979ff',
  optionColor: '#7c4dff',
  futureColor: '#00b0ff',
  // Typography
  fontDisplay: "'DM Sans', -apple-system, sans-serif",
  fontMono:    "'JetBrains Mono', 'Fira Code', monospace",
  fontSans:    "'DM Sans', -apple-system, sans-serif",
}

export const colorPnL     = (n) => n >= 0 ? THEME.green : THEME.red
export const bgPnL        = (n) => n >= 0 ? THEME.greenDim : THEME.redDim
export const segmentColor = (seg) => ({ equity: THEME.equityColor, options: THEME.optionColor, futures: THEME.futureColor })[seg] || THEME.accent
