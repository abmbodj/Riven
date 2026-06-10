import React, { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import BroadcastsTab from './BroadcastsTab.jsx';

const haptics = {
  light: vi.fn(),
  medium: vi.fn(),
};

const messages = [
  {
    id: 1,
    title: 'Live update',
    content: 'Riven is online.',
    type: 'success',
    isActive: true,
    createdBy: 'owner',
    createdAt: '2026-05-01T12:00:00.000Z',
  },
  {
    id: 2,
    title: 'Paused maintenance',
    content: 'This message is paused.',
    type: 'warning',
    isActive: false,
    createdBy: 'owner',
    createdAt: '2026-05-02T12:00:00.000Z',
  },
];

function BroadcastHarness({ onSubmit = vi.fn(), initialShowForm = false } = {}) {
  const [form, setForm] = useState({ title: '', content: '', type: 'info' });
  const [showForm, setShowForm] = useState(initialShowForm);

  return (
    <BroadcastsTab
      messages={messages}
      form={form}
      setForm={setForm}
      showForm={showForm}
      setShowForm={setShowForm}
      onSubmit={onSubmit}
      onToggle={vi.fn()}
      onDelete={vi.fn()}
      loading={false}
      haptics={haptics}
    />
  );
}

describe('BroadcastsTab', () => {
  it('filters broadcasts by operational status', () => {
    render(<BroadcastHarness />);

    fireEvent.click(screen.getByRole('button', { name: /paused/i }));

    expect(screen.getByText('Paused maintenance')).toBeInTheDocument();
    expect(screen.queryByText('Live update')).not.toBeInTheDocument();
  });

  it('opens the composer and submits through the existing handler', () => {
    const onSubmit = vi.fn((event) => event.preventDefault());
    render(<BroadcastHarness onSubmit={onSubmit} />);

    fireEvent.click(screen.getByRole('button', { name: /new broadcast/i }));
    fireEvent.click(screen.getByRole('button', { name: /warning/i }));
    fireEvent.change(screen.getByLabelText(/title/i), {
      target: { value: 'Maintenance' },
    });
    fireEvent.change(screen.getByLabelText(/content/i), {
      target: { value: 'Riven will be briefly unavailable.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send broadcast/i }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
