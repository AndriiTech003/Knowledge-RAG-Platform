import { citationNumbers, markUncitedClaims, renderableMarkdown, replaceCitations } from './message-render';

describe('message rendering', () => {
  it('replaces [n] markers with citation placeholders', () => {
    expect(replaceCitations('Fact [1] and [2].')).toBe('Fact <span class="kb-cite" data-n="1"></span> and <span class="kb-cite" data-n="2"></span>.');
  });

  it('expands grouped citations like [1, 3]', () => {
    expect(citationNumbers('See [1, 3] and [2]')).toEqual([1, 2, 3]);
    expect(replaceCitations('[1, 3]')).toContain('data-n="3"');
  });

  it('does not treat markdown links as citations', () => {
    expect(replaceCitations('[1](http://x)')).toBe('[1](http://x)');
  });

  it('wraps uncited claims in a dotted underline span with a tooltip', () => {
    const out = markUncitedClaims('Cited [1]. Unsupported claim here.', ['Unsupported claim here.']);
    expect(out).toContain('<span class="kb-uncited"');
    expect(out).toContain('data-tip="No source supports this statement"');
  });

  it('leaves fenced code blocks untouched', () => {
    const md = 'Text [1]\n```\narr[1]\n```';
    expect(renderableMarkdown(md)).toContain('arr[1]');
    expect(renderableMarkdown(md)).toContain('data-n="1"');
  });
});
