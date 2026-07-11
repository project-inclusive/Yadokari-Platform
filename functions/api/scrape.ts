import * as cheerio from 'cheerio';

export const onRequestPost: PagesFunction = async (context) => {
  try {
    const { url } = await context.request.json() as { url?: string };
    if (!url) {
      return new Response(JSON.stringify({ error: 'URL is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      return new Response(JSON.stringify({ error: `Failed to fetch URL: ${response.statusText}` }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const contentType = response.headers.get('content-type') || '';
    const isPdf = contentType.toLowerCase().includes('application/pdf') || url.toLowerCase().endsWith('.pdf');

    if (isPdf) {
      return new Response(JSON.stringify({
        error: 'PDFファイルからのテキスト自動読み込みには現在対応していません。お手数ですが、PDFのテキスト内容をコピーして、メッセージ欄に直接貼り付けて送信してください。'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Remove unneeded elements
    $('script, style, nav, header, footer, iframe, noscript, svg, form, img').remove();

    let bodyText = $('body').text();
    bodyText = bodyText
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n')
      .trim();

    return new Response(JSON.stringify({
      url,
      title: $('title').text().trim(),
      content: bodyText
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    return new Response(JSON.stringify({
      error: error.message || 'Internal server error',
      stack: error.stack
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
