import { Hono } from 'hono'
import { stream } from 'hono/streaming'

export function getChatRoute() {
  const route = new Hono()

  route.post('/', async (c) => {
    const apiKey = process.env.OPENROUTER_API_KEY
    if (!apiKey || apiKey === 'your_openrouter_api_key_here') {
      return c.json({ error: 'OpenRouter API key is not configured on the server. Please check your .env file.' }, 500)
    }

    try {
      const body = await c.req.json()
      const { messages, model, response_format } = body

      if (!messages || !Array.isArray(messages)) {
        return c.json({ error: 'Messages array is required' }, 400)
      }

      const selectedModel = model || 'openai/gpt-oss-120b'
      console.log(`LLM Request to ${selectedModel}. Structured Outputs (response_format) payload present: ${!!response_format}`)

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://github.com/project-inclusive/Yadokari-Platform',
          'X-Title': 'Yadokari Platform Console',
        },
        body: JSON.stringify({
          model: selectedModel,
          messages: messages,
          stream: true,
          response_format: response_format
        })
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('OpenRouter API error:', errorText)
        return c.json({ error: `LLM Router Error: ${response.statusText}`, details: errorText }, response.status as any)
      }

      // レスポンスヘッダーを text/event-stream に設定
      c.header('Content-Type', 'text/event-stream')
      c.header('Cache-Control', 'no-cache')
      c.header('Connection', 'keep-alive')

      return stream(c, async (streamInstance) => {
        const reader = response.body?.getReader()
        if (!reader) {
          return
        }

        const decoder = new TextDecoder()
        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            await streamInstance.write(new TextEncoder().encode(chunk))
          }
        } catch (err) {
          console.error('Stream processing error:', err)
        } finally {
          reader.releaseLock()
        }
      })

    } catch (error: any) {
      console.error('Chat routing error:', error)
      return c.json({ error: error.message || 'Internal server error' }, 500)
    }
  })

  return route
}
