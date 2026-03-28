type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

export interface OllamaChatOptions {
  host: string; // e.g. http://127.0.0.1:11434
  model: string; // e.g. qwen2.5:7b
  systemPrompt: string;
  userPrompt: string;
  temperature?: number;
  numPredict?: number;
}

function normalizeHost(host: string): string {
  return host.replace(/\/+$/, '');
}

export async function ollamaChat(opts: OllamaChatOptions): Promise<string> {
  const host = normalizeHost(opts.host);
  const payload = {
    model: opts.model,
    messages: [
      { role: 'system', content: opts.systemPrompt },
      { role: 'user', content: opts.userPrompt },
    ] satisfies ChatMessage[],
    stream: false,
    options: {
      temperature: opts.temperature ?? 0.2,
      num_predict: opts.numPredict ?? 220,
    },
  };

  const res = await fetch(`${host}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Ollama request failed (${res.status}): ${body || '<empty>'}`);
  }

  const data: unknown = await res.json();
  if (
    typeof data === 'object' &&
    data &&
    'message' in data &&
    typeof (data as { message?: unknown }).message === 'object' &&
    (data as { message?: { content?: unknown } }).message?.content
  ) {
    const content = (data as { message: { content?: unknown } }).message.content;
    if (typeof content === 'string') {
      return content.trim();
    }
  }

  throw new Error('Unexpected Ollama response shape (missing message.content).');
}
