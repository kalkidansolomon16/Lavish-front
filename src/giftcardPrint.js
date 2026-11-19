// Printed gift cards (credit-card size, 85.6 × 54 mm) in the Lavish design:
//   front — the same on every card: teal, "Lavish · Medical Spa", "Gift Card", tagline and website;
//   back  — per card: To / From / Gift of lines, the terms, a QR code and the card number, contact strip.
// The QR code holds the card number without dashes, so the app's camera scanner and a 2D (QR) desk scanner
// both "type" it into any code field. Code 128 barcodes are still available (barcodeSvg) for 1D scanners.
import JsBarcode from 'jsbarcode'
import qrcode from 'qrcode-generator'

export const DESIGNS = { classic: ['#0a7379', '#06484c'], gold: ['#e3c8b6', '#a37a62'], botanical: ['#5f8f73', '#2f5a45'], birthday: ['#d98a9a', '#9c4f63'], thank_you: ['#262626', '#4a4a4a'] }

// Printed on every card (from Lavish's card design). Change here if the details change.
export const CARD_INFO = {
  tagline: 'Ultra Luxury in Science and Beauty',
  website: 'lavishmedicalspa.com',
  phone: '+251 972 444 447',
  cities: 'Addis Ababa · Adama · Dire Dawa',
  terms: 'Valid once activated at purchase. Use for services or products; any remaining balance stays on the card. Not exchangeable for cash.',
}

export const plain = (code) => String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/** "AB12CD34EF56GH78" → "AB12 CD34 EF56 GH78" (how the number is printed). */
export const grouped = (code) => plain(code).replace(/(.{4})(?=.)/g, '$1 ')

/** SVG markup of a Code 128 barcode for `code`. */
export function barcodeSvg(code, { height = 46, width = 1.6 } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svg, plain(code), { format: 'CODE128', height, width, displayValue: false, margin: 0, background: 'transparent' })
  return svg.outerHTML
}

/** SVG markup of a QR code for `code` (scales to its container). */
export function qrSvg(code, { color = '#1c3d3f' } = {}) {
  const qr = qrcode(0, 'M')
  qr.addData(plain(code))
  qr.make()
  const n = qr.getModuleCount()
  let d = ''
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c} ${r}h1v1h-1z`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 ${n + 2} ${n + 2}" shape-rendering="crispEdges"><rect x="-1" y="-1" width="${n + 2}" height="${n + 2}" fill="#fff"/><path d="${d}" fill="${color}"/></svg>`
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/** Front of the card (same on every card). */
export function cardFrontHtml() {
  return `<div class="lv-card lv-front">
    <svg class="rings" viewBox="0 0 200 200" aria-hidden="true"><circle cx="150" cy="70" r="55"/><circle cx="150" cy="70" r="80"/><circle cx="150" cy="70" r="105"/><circle cx="150" cy="70" r="130"/></svg>
    <div class="brand"><b>Lavish</b><span>MEDICAL SPA</span></div>
    <div class="title">Gift Card<i></i></div>
    <div class="foot"><span>${esc(CARD_INFO.tagline)}</span><b>${esc(CARD_INFO.website.toUpperCase())}</b></div>
  </div>`
}

/** Back of the card: { code, to?, from?, value? } — empty lines are left for writing by hand. */
export function cardBackHtml(c) {
  return `<div class="lv-card lv-back">
    <div class="main">
      <div class="left">
        <div class="brand">Lavish</div>
        <div class="line"><b>TO</b><span>${esc(c.to ?? '')}</span></div>
        <div class="line"><b>FROM</b><span>${esc(c.from ?? '')}</span></div>
        <div class="line"><b>GIFT OF</b><span>${esc(c.value ?? '')}</span></div>
        <p class="terms">${esc(CARD_INFO.terms)}</p>
      </div>
      <div class="right">
        <div class="qr">${qrSvg(c.code)}</div>
        <div class="no">CARD NO.</div>
        <div class="num">${(grouped(c.code).match(/\S+(?: \S+)?/g) ?? []).map(esc).join('<br>')}</div>
        <div class="check">Check balance in the Lavish app</div>
      </div>
    </div>
    <div class="strip"><span>${esc(CARD_INFO.cities)}</span><span>${esc(CARD_INFO.phone)}</span><span>${esc(CARD_INFO.website)}</span></div>
  </div>`
}

/** Card styles; sizes in mm so the print is exactly credit-card size. Used by the print window and the portal preview. */
export const CARD_CSS = `
  .lv-card { width: 85.6mm; height: 54mm; border-radius: 3.2mm; position: relative; overflow: hidden; font-family: Inter, Roboto, 'Segoe UI', Arial, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
  .lv-card * { box-sizing: border-box; }
  .lv-front { background: #0b7177; color: #fff; padding: 6.5mm 7mm 5.5mm; display: flex; flex-direction: column; }
  .lv-front .rings { position: absolute; right: -14mm; top: -12mm; width: 62mm; height: 62mm; fill: none; stroke: rgba(255,255,255,.22); stroke-width: .5; }
  .lv-front .brand b { display: block; font: 500 15pt/1 'EB Garamond', Georgia, serif; letter-spacing: .2px; }
  .lv-front .brand span { display: block; margin-top: 1.2mm; font-size: 5pt; letter-spacing: 1.6px; font-weight: 600; opacity: .9; }
  .lv-front .title { margin-top: auto; margin-bottom: 7mm; position: relative; font: italic 400 25pt/1 'EB Garamond', Georgia, serif; }
  .lv-front .title i { position: absolute; left: 0; bottom: -2.2mm; width: 9mm; height: .35mm; background: #c9a48c; }
  .lv-front .title i::after { content: ''; position: absolute; right: -1mm; top: -.6mm; width: 1.4mm; height: 1.4mm; border-radius: 50%; background: #c9a48c; }
  .lv-front .foot { display: flex; justify-content: space-between; align-items: baseline; font-size: 5.6pt; }
  .lv-front .foot b { font-weight: 600; letter-spacing: 1.3px; }
  .lv-back { background: #f6f4f0; color: #3d4a4b; border: .25mm solid #c9d9e4; display: flex; flex-direction: column; }
  .lv-back .main { flex: 1; display: flex; gap: 4mm; padding: 4.5mm 5.5mm 0; }
  .lv-back .left { flex: 1; min-width: 0; }
  .lv-back .brand { font: 500 12pt/1 'EB Garamond', Georgia, serif; color: #0b7177; margin-bottom: 3mm; }
  .lv-back .line { display: flex; align-items: flex-end; gap: 2mm; height: 5.2mm; }
  .lv-back .line b { width: 12mm; flex: none; font-size: 5pt; letter-spacing: .9px; color: #0b7177; font-weight: 700; }
  .lv-back .line span { flex: 1; border-bottom: .25mm solid #b9cfcf; font: italic 8pt 'EB Garamond', Georgia, serif; color: #2c3a3b; padding: 0 1mm .4mm; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .lv-back .terms { margin: 2.6mm 0 0; font-size: 4.4pt; line-height: 1.4; color: #6b7677; }
  .lv-back .right { width: 22mm; flex: none; display: flex; flex-direction: column; align-items: center; text-align: center; }
  .lv-back .qr { width: 19mm; height: 19mm; padding: 1mm; border: .25mm dashed #b88e7a; border-radius: .8mm; background: #fff; }
  .lv-back .qr svg { width: 100%; height: 100%; display: block; }
  .lv-back .no { margin-top: 1.6mm; font-size: 4.6pt; font-weight: 700; letter-spacing: 1px; color: #0b7177; }
  .lv-back .num { margin-top: .6mm; font: 600 5.8pt/1.4 ui-monospace, Consolas, monospace; letter-spacing: .5px; color: #0b7177; white-space: nowrap; }
  .lv-back .check { margin-top: 1mm; font-size: 4.3pt; color: #6b7677; line-height: 1.3; }
  .lv-back .strip { display: flex; justify-content: space-between; align-items: center; height: 6.2mm; padding: 0 5.5mm; background: #0b7177; color: #fff; font-size: 4.8pt; font-weight: 500; }
`

const FONTS = 'https://fonts.googleapis.com/css2?family=EB+Garamond:ital,wght@0,500;1,400&family=Inter:wght@400;500;600;700&display=swap'

/**
 * Opens a print window. cards: [{ code, value?, to?, from? }]
 * Each card prints its front and back side by side, credit-card size, with cut lines.
 */
export function printCards(cards, { title = 'Lavish gift cards' } = {}) {
  const w = window.open('', '_blank')
  if (!w) return false
  const body = cards.map((c) => `<div class="pair">${cardFrontHtml()}${cardBackHtml(c)}</div>`).join('')
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
  <link rel="stylesheet" href="${FONTS}">
  <style>
    @page { size: A4; margin: 10mm; }
    body { margin: 0; font-family: Inter, 'Segoe UI', Roboto, Arial, sans-serif; color: #222; }
    .bar { padding: 10px 0 14px; display: flex; gap: 10px; align-items: center; }
    .bar button { padding: 8px 16px; border-radius: 8px; border: 0; background: #0b7177; color: #fff; font-size: 14px; cursor: pointer; }
    .pair { display: flex; gap: 6mm; margin-bottom: 6mm; break-inside: avoid; }
    .pair .lv-card { outline: .2mm dashed #bbb; outline-offset: .8mm; }
    ${CARD_CSS}
    @media print { .bar { display: none; } }
  </style></head><body>
    <div class="bar"><button onclick="print()">🖨 Print</button><span>${cards.length} card${cards.length === 1 ? '' : 's'} · front and back · cut along the dashed line</span></div>
    ${body}
  </body></html>`)
  w.document.close()
  return true
}

/** CSV for the printing company: one row per card — the printed number and the value to put in the QR code. */
export function cardsCsv(batch, codes) {
  const rows = [['batch', 'card_number', 'qr_value', 'qr_format', 'barcode_format'], ...codes.map((c) => [batch, grouped(c), plain(c), 'QR (error level M)', 'CODE128 (optional, same value)'])]
  const url = URL.createObjectURL(new Blob([rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' }))
  Object.assign(document.createElement('a'), { href: url, download: `${batch.replace(/[^\w-]+/g, '_')}.csv` }).click()
  URL.revokeObjectURL(url)
}
