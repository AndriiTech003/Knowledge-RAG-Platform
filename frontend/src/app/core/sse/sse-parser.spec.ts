import { decodeSseData, flushSse, parseSseBlock, parseSseChunk, SseParser } from './sse-parser';

describe('SSE parser', () => {
  it('parses a single complete event', () => {
    const { events, rest } = parseSseChunk('', 'event: token\ndata: {"t":"Hi"}\n\n');
    expect(events).toEqual([{ event: 'token', data: '{"t":"Hi"}', id: null, retry: null }]);
    expect(rest).toBe('');
  });

  it('keeps an incomplete block in the buffer until the separator arrives', () => {
    const first = parseSseChunk('', 'event: meta\ndata: {"a"');
    expect(first.events).toHaveLength(0);
    const second = parseSseChunk(first.rest, ':1}\n\nevent: token\n');
    expect(second.events).toHaveLength(1);
    expect(second.events[0].data).toBe('{"a":1}');
    expect(second.rest).toBe('event: token\n');
  });

  it('defaults the event name to message and joins multi-line data', () => {
    const event = parseSseBlock('data: line one\ndata: line two');
    expect(event).toEqual({ event: 'message', data: 'line one\nline two', id: null, retry: null });
  });

  it('ignores comments and heartbeat blocks', () => {
    const { events } = parseSseChunk('', ': keep-alive\n\nevent: done\ndata: {}\n\n');
    expect(events.map((e) => e.event)).toEqual(['done']);
  });

  it('normalises CRLF line endings', () => {
    const { events } = parseSseChunk('', 'event: token\r\ndata: {"t":"x"}\r\n\r\n');
    expect(events[0].event).toBe('token');
  });

  it('reads id and retry fields', () => {
    expect(parseSseBlock('id: 42\nretry: 3000\ndata: x')).toEqual({ event: 'message', data: 'x', id: '42', retry: 3000 });
  });

  it('strips only one leading space from values', () => {
    expect(parseSseBlock('data:  two spaces')?.data).toBe(' two spaces');
  });

  it('decodes JSON payloads and falls back to raw text', () => {
    expect(decodeSseData({ event: 'a', data: '{"n":1}', id: null, retry: null }).data).toEqual({ n: 1 });
    expect(decodeSseData({ event: 'a', data: 'plain', id: null, retry: null }).data).toBe('plain');
  });

  it('streams across arbitrary chunk boundaries with the stateful parser', () => {
    const parser = new SseParser();
    const text = 'event: token\ndata: {"t":"a"}\n\nevent: token\ndata: {"t":"b"}\n\nevent: done\ndata: {}';
    const events = [];
    for (let i = 0; i < text.length; i += 7) events.push(...parser.feed(text.slice(i, i + 7)));
    events.push(...parser.flush());
    expect(events.map((e) => e.event)).toEqual(['token', 'token', 'done']);
  });

  it('flushes nothing for an empty buffer', () => {
    expect(flushSse('')).toEqual([]);
  });
});
