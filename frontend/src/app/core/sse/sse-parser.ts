export interface RawSseEvent {
  event: string;
  data: string;
  id: string | null;
  retry: number | null;
}

export interface SseEvent<T = unknown> {
  event: string;
  data: T;
  id: string | null;
}

export interface SseParseResult {
  events: RawSseEvent[];
  rest: string;
}

export function normalizeNewlines(text: string): string {
  return text.replace(/\r\n?/g, '\n');
}

export function parseSseBlock(block: string): RawSseEvent | null {
  let event = 'message';
  const data: string[] = [];
  let id: string | null = null;
  let retry: number | null = null;
  let hasField = false;
  for (const line of block.split('\n')) {
    if (line === '' || line.startsWith(':')) continue;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    switch (field) {
      case 'event':
        event = value || 'message';
        hasField = true;
        break;
      case 'data':
        data.push(value);
        hasField = true;
        break;
      case 'id':
        id = value;
        hasField = true;
        break;
      case 'retry': {
        const parsed = Number.parseInt(value, 10);
        if (Number.isFinite(parsed)) retry = parsed;
        break;
      }
      default:
        break;
    }
  }
  if (!hasField || data.length === 0) return null;
  return { event, data: data.join('\n'), id, retry };
}

export function parseSseChunk(buffer: string, chunk: string): SseParseResult {
  const text = normalizeNewlines(buffer + chunk);
  const blocks = text.split('\n\n');
  const rest = blocks.pop() ?? '';
  const events: RawSseEvent[] = [];
  for (const block of blocks) {
    const parsed = parseSseBlock(block);
    if (parsed) events.push(parsed);
  }
  return { events, rest };
}

export function flushSse(rest: string): RawSseEvent[] {
  const parsed = parseSseBlock(normalizeNewlines(rest));
  return parsed ? [parsed] : [];
}

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function decodeSseData<T>(raw: RawSseEvent): SseEvent<T> {
  return { event: raw.event, data: parseJson(raw.data) as T, id: raw.id };
}

export class SseParser {
  private buffer = '';

  feed(chunk: string): RawSseEvent[] {
    const { events, rest } = parseSseChunk(this.buffer, chunk);
    this.buffer = rest;
    return events;
  }

  flush(): RawSseEvent[] {
    const events = flushSse(this.buffer);
    this.buffer = '';
    return events;
  }
}
