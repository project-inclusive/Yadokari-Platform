import { Hono } from 'hono'
import * as cheerio from 'cheerio'

// Shim to resolve Object.defineProperty errors on global prototypes in some environments
if (typeof globalThis.ReadableStream === 'function') {
  try {
    const OriginalReadableStream: any = globalThis.ReadableStream;
    class PolyfilledReadableStream extends OriginalReadableStream {}
    
    // Copy static properties
    for (const key of Reflect.ownKeys(OriginalReadableStream)) {
      if (key !== 'prototype' && key !== 'name' && key !== 'length') {
        try {
          Object.defineProperty(PolyfilledReadableStream, key, 
            Object.getOwnPropertyDescriptor(OriginalReadableStream, key) || {}
          );
        } catch (e) {}
      }
    }
    
    // Ensure the prototype has necessary descriptors/methods
    if (OriginalReadableStream.prototype) {
      for (const key of Reflect.ownKeys(OriginalReadableStream.prototype)) {
        if (key !== 'constructor') {
          try {
            Object.defineProperty(PolyfilledReadableStream.prototype, key,
              Object.getOwnPropertyDescriptor(OriginalReadableStream.prototype, key) || {}
            );
          } catch (e) {}
        }
      }
    }
    
    globalThis.ReadableStream = PolyfilledReadableStream as any;
  } catch (e) {}
}

if (typeof globalThis.navigator === 'object' && globalThis.navigator !== null) {
  try {
    const originalNavigator = globalThis.navigator;
    const polyfilledNavigator = Object.create(originalNavigator);
    
    let platform = '';
    let userAgent = '';
    try { platform = originalNavigator.platform || ''; } catch (e) {}
    try { userAgent = originalNavigator.userAgent || ''; } catch (e) {}
    
    Object.defineProperty(polyfilledNavigator, 'platform', {
      get() { return platform; },
      set(val) { platform = val; },
      configurable: true,
      enumerable: true
    });
    
    Object.defineProperty(polyfilledNavigator, 'userAgent', {
      get() { return userAgent; },
      set(val) { userAgent = val; },
      configurable: true,
      enumerable: true
    });
    
    try {
      globalThis.navigator = polyfilledNavigator;
    } catch (e) {
      try {
        Object.defineProperty(globalThis, 'navigator', {
          value: polyfilledNavigator,
          writable: true,
          configurable: true
        });
      } catch (e2) {}
    }
  } catch (e) {}
}

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
        const arrayBuffer = await response.arrayBuffer()
        const { getDocumentProxy, extractText } = await import('unpdf')
        const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer))
        const { text } = await extractText(pdf)
        const textContent = Array.isArray(text) ? text.join('\n') : (text || '')

        return c.json({
          url,
          title: url.split('/').pop() || 'PDF Document',
          content: textContent.trim()
        })
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
