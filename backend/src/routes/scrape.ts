import { Hono } from 'hono'
import * as cheerio from 'cheerio'

export function getScrapingRoute() {
  const route = new Hono()

  route.post('/', async (c) => {
    try {
      const { url } = await c.req.json()
      if (!url) {
        return c.json({ error: 'URL is required' }, 400)
      }

      console.log(`Scraping URL: ${url}`)
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      })

      if (!response.ok) {
        return c.json({ error: `Failed to fetch URL: ${response.statusText}` }, response.status as any)
      }

      const contentType = response.headers.get('content-type') || ''
      const isPdf = contentType.toLowerCase().includes('application/pdf') || url.toLowerCase().endsWith('.pdf')

      if (isPdf) {
        return c.json({
          error: 'PDFファイルからのテキスト自動読み込みには現在対応していません。お手数ですが、PDFのテキスト内容をコピーして、メッセージ欄に直接貼り付けて送信してください。'
        }, 400)
      }

      const html = await response.text()
      const $ = cheerio.load(html)

      // 不要な要素を削除してテキストをプレーンにする
      $('script, style, nav, header, footer, iframe, noscript, svg, form, img').remove()

      let bodyText = $('body').text()
      
      // 不要な空白や改行の整理
      bodyText = bodyText
        .replace(/\s+/g, ' ')
        .replace(/\n\s*\n/g, '\n')
        .trim()

      return c.json({
        url,
        title: $('title').text().trim(),
        content: bodyText
      })

    } catch (error: any) {
      console.error('Scraping error:', error)
      return c.json({ error: error.message || 'Internal server error' }, 500)
    }
  })

  return route
}
