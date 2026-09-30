// Renders public/icons/icon.svg to the PNG sizes iOS / Android need.
// Only needed after editing the SVG. Requires Playwright: npx -y -p playwright node scripts/render-icons.mjs
import { chromium } from 'playwright'
import { readFileSync } from 'node:fs'

const svg = readFileSync(new URL('../public/icons/icon.svg', import.meta.url), 'utf8')
const targets = [
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['apple-touch-icon.png', 180, 0],
  ['icon-maskable-512.png', 512, 0.12],
]
const browser = await chromium.launch()
const page = await browser.newPage()
for (const [name, size, pad] of targets) {
  await page.setViewportSize({ width: size, height: size })
  const inner = Math.round(size * (1 - pad * 2))
  await page.setContent(
    `<body style="margin:0;background:#0a0a0b;display:grid;place-items:center;width:${size}px;height:${size}px">` +
      svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `) +
      '</body>',
  )
  await page.screenshot({ path: new URL(`../public/icons/${name}`, import.meta.url).pathname })
}
await browser.close()
