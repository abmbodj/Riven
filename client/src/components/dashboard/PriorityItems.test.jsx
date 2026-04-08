import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import PriorityItems from './PriorityItems.jsx';

function renderPriorityItems(items, props = {}) {
  render(
    <MemoryRouter>
      <PriorityItems items={items} {...props} />
    </MemoryRouter>,
  );
}

describe('PriorityItems', () => {
  it('expands the queue inline after the first five items', () => {
    renderPriorityItems([
      { id: 1, title: 'One', tone: 'overdue', urgencyLabel: 'Overdue 3d', className: 'Bio', classColor: '#7a9e72', to: '/class/1' },
      { id: 2, title: 'Two', tone: 'overdue', urgencyLabel: 'Overdue 1d', className: 'Bio', classColor: '#7a9e72', to: '/class/1' },
      { id: 3, title: 'Three', tone: 'today', urgencyLabel: 'Due today', className: 'Bio', classColor: '#7a9e72', to: '/class/1' },
      { id: 4, title: 'Four', tone: 'today', urgencyLabel: 'Due today', className: 'Bio', classColor: '#7a9e72', to: '/class/1' },
      { id: 5, title: 'Five', tone: 'tomorrow', urgencyLabel: 'Due tomorrow', className: 'Bio', classColor: '#7a9e72', to: '/class/1' },
      { id: 6, title: 'Six', tone: 'tomorrow', urgencyLabel: 'Due tomorrow', className: 'Bio', classColor: '#7a9e72', to: '/class/1' },
    ]);

    expect(screen.getByText('One')).toBeInTheDocument();
    expect(screen.getByText('Five')).toBeInTheDocument();
    expect(screen.queryByText('Six')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /show all \(6\)/i }));

    expect(screen.getByText('Six')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /show fewer/i })).toBeInTheDocument();
  });

  it('renders the empty state when nothing is urgent', () => {
    renderPriorityItems([]);

    expect(screen.getByText(/nothing urgent right now/i)).toBeInTheDocument();
  });

  it('renders a completion control and calls through when clicked', () => {
    const handleComplete = vi.fn();

    renderPriorityItems([
      { id: 1, assignmentId: 1, title: 'One', tone: 'overdue', urgencyLabel: 'Overdue 3d', className: 'Bio', classColor: '#7a9e72', to: '/class/1' },
    ], { onComplete: handleComplete });

    fireEvent.click(screen.getByRole('button', { name: /mark one complete/i }));

    expect(handleComplete).toHaveBeenCalledWith(expect.objectContaining({ assignmentId: 1, title: 'One' }));
    expect(screen.getByRole('link', { name: /one/i })).toBeInTheDocument();
  });

  it('shows a pending completion state when the item is saving', () => {
    renderPriorityItems([
      { id: 1, assignmentId: 1, title: 'One', tone: 'today', urgencyLabel: 'Due today', className: 'Bio', classColor: '#7a9e72', to: '/class/1' },
    ], { onComplete: vi.fn(), completingIds: [1] });

    expect(screen.getByRole('button', { name: /marking one complete/i })).toBeDisabled();
    expect(screen.getByText(/saving/i)).toBeInTheDocument();
  });
});
