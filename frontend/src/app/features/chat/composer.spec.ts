import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { Composer } from './composer';

describe('Composer', () => {
  it('sends on Enter and inserts a newline on Shift+Enter', async () => {
    const sent: string[] = [];
    await render(Composer, { on: { sent: (v: string) => sent.push(v) } });
    const box = screen.getByTestId('composer-input');
    await userEvent.type(box, 'line one{Shift>}{Enter}{/Shift}line two');
    expect(sent).toEqual([]);
    await userEvent.type(box, '{Enter}');
    expect(sent).toEqual(['line one\nline two']);
    expect(box).toHaveValue('');
  });

  it('shows a Stop button while streaming', async () => {
    let stopped = 0;
    await render(Composer, { inputs: { streaming: true }, on: { stopped: () => (stopped += 1) } });
    await userEvent.click(screen.getByTestId('stop-button'));
    expect(stopped).toBe(1);
    expect(screen.queryByTestId('send-button')).toBeNull();
  });
});
