import { render, screen } from '@testing-library/angular';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('animates in-progress ingestion statuses', async () => {
    await render(StatusBadge, { inputs: { status: 'embedding' } });
    const badge = screen.getByTestId('status-badge');
    expect(badge).toHaveTextContent('Embedding');
    expect(badge).toHaveClass('badge--active');
  });

  it('renders terminal statuses without animation', async () => {
    await render(StatusBadge, { inputs: { status: 'ready' } });
    expect(screen.getByTestId('status-badge')).not.toHaveClass('badge--active');
    expect(screen.getByTestId('status-badge')).toHaveAttribute('data-status', 'ready');
  });
});
