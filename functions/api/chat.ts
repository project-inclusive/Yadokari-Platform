export const onRequestPost: PagesFunction<{ OPENROUTER_API_KEY: string }> = async (context) => {
  try {
    const apiKey = context.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OpenRouter API key is not configured on Cloudflare Pages environment variables.' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const body: any = await context.request.json();
    const { messages, model, response_format } = body;

    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: 'Messages array is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const selectedModel = model || 'openai/gpt-5.4-mini';

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
        response_format: response_format,
        max_tokens: 12288,
        temperature: 0.1
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `LLM Router Error: ${response.statusText}`, details: errorText }), {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream back the OpenRouter SSE response
    return new Response(response.body, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
