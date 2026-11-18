// Printed gift cards: Code 128 barcodes and a print sheet of credit-card-sized cards (85.6 × 54 mm).
// The barcode holds the card number without dashes, so a USB barcode scanner at the desk simply "types" it
// into any code field (followed by Enter).
import JsBarcode from 'jsbarcode'

export const DESIGNS = { classic: ['#0a7379', '#06484c'], gold: ['#e3c8b6', '#a37a62'], botanical: ['#5f8f73', '#2f5a45'], birthday: ['#d98a9a', '#9c4f63'], thank_you: ['#262626', '#4a4a4a'] }

export const plain = (code) => String(code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/** SVG markup of a Code 128 barcode for `code`. */
export function barcodeSvg(code, { height = 46, width = 1.6 } = {}) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  JsBarcode(svg, plain(code), { format: 'CODE128', height, width, displayValue: false, margin: 0, background: 'transparent' })
  return svg.outerHTML
}

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/**
 * Opens a print window. cards: [{ code, value?, label?, expires?, design? }]
 * Each card prints its front (design, logo, value) and back (barcode + number) side by side.
 */
export function printCards(cards, { title = 'Lavish gift cards' } = {}) {
  const w = window.open('', '_blank')
  if (!w) return false
  const logo = `${location.origin}/img/logo-white.png`
  const body = cards.map((c) => {
    const [a, b] = DESIGNS[c.design] ?? DESIGNS.classic
    return `<div class="pair">
      <div class="card front" style="background:linear-gradient(135deg,${a},${b})">
        <img src="${logo}" alt="Lavish">
        <div class="v">${esc(c.value ?? 'Gift card')}</div>
        <div class="s">${esc(c.label ?? 'Lavish Medical Spa')}</div>
      </div>
      <div class="card back">
        <div class="bc">${barcodeSvg(c.code)}</div>
        <div class="code">${esc(c.code)}</div>
        <div class="fine">${c.expires ? 'Valid until ' + esc(c.expires) + ' · ' : ''}${c.value ? 'Show this card at the Lavish front desk or add the number in the Lavish app.' : 'Activated when paid at the Lavish front desk. Then show this card or add the number in the Lavish app.'}</div>
      </div>
    </div>`
  }).join('')
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; font-family: 'Segoe UI', Roboto, Arial, sans-serif; color: #222; }
    .bar { padding: 10px 0 14px; display: flex; gap: 10px; align-items: center; }
    .bar button { padding: 8px 16px; border-radius: 8px; border: 0; background: #0a7379; color: #fff; font-size: 14px; cursor: pointer; }
    .pair { display: flex; gap: 6mm; margin-bottom: 6mm; break-inside: avoid; }
    .card { width: 85.6mm; height: 54mm; border-radius: 3.5mm; padding: 5mm 6mm; position: relative; overflow: hidden; border: .2mm dashed #bbb; }
    .front { color: #fff; display: flex; flex-direction: column; justify-content: space-between; border: 0; }
    .front img { width: 30mm; }
    .front .v { font: 500 22pt Georgia, 'EB Garamond', serif; }
    .front .s { font-size: 8pt; letter-spacing: 1.5px; text-transform: uppercase; opacity: .85; }
    .back { background: #fff; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
    .back .bc svg { width: 64mm; height: 15mm; }
    .back .code { margin-top: 2mm; font: 600 12pt ui-monospace, Consolas, monospace; letter-spacing: 1.5px; }
    .back .fine { margin-top: 2.5mm; font-size: 6.5pt; color: #666; line-height: 1.35; }
    @media print { .bar { display: none; } }
  </style></head><body>
    <div class="bar"><button onclick="print()">🖨 Print</button><span>${cards.length} card${cards.length === 1 ? '' : 's'} · front and back · cut along the dashed line</span></div>
    ${body}
  </body></html>`)
  w.document.close()
  return true
}

/** CSV for the printing company: one row per card (number + the same number without dashes for the barcode). */
export function cardsCsv(batch, codes) {
  const rows = [['batch', 'card_number', 'barcode_value', 'barcode_format'], ...codes.map((c) => [batch, c, plain(c), 'CODE128'])]
  const url = URL.createObjectURL(new Blob([rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')], { type: 'text/csv' }))
  Object.assign(document.createElement('a'), { href: url, download: `${batch.replace(/[^\w-]+/g, '_')}.csv` }).click()
  URL.revokeObjectURL(url)
}
