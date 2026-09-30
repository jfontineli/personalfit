import { chromium } from '@playwright/test'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public')
const browser = await chromium.launch()
try {
  for (const size of [192, 512]) {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
    await page.goto(pathToFileURL(join(publicDir, 'icon.svg')).href)
    await page.locator('svg').evaluate((icon, pixels) => {
      icon.style.width = `${pixels}px`
      icon.style.height = `${pixels}px`
    }, size)
    await page.locator('svg').screenshot({ path: join(publicDir, `icon-${size}.png`) })
    await page.close()
  }
} finally {
  await browser.close()
}
