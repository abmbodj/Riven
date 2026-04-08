import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SectionedPreview from './SectionedPreview';

vi.mock('../editor/TiptapEditor', () => ({
  default: ({ content }) => (
    <div data-testid="section-content">
      {content?.content?.[0]?.content?.[0]?.text || ''}
    </div>
  ),
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

const makeDoc = (text) => ({
  type: 'doc',
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

describe('SectionedPreview', () => {
  it('renders each section', () => {
    render(
      <SectionedPreview
        sections={[makeDoc('Section one'), makeDoc('Section two')]}
        sectionsTotal={4}
        statusText="Generating notes..."
      />
    );
    expect(screen.getAllByTestId('section-content')).toHaveLength(2);
    expect(screen.getByText('Section one')).toBeInTheDocument();
    expect(screen.getByText('Section two')).toBeInTheDocument();
  });

  it('shows progress label with total', () => {
    render(<SectionedPreview sections={[makeDoc('A')]} sectionsTotal={8} statusText="Drafting" />);
    expect(screen.getByText(/1 of 8 sections complete/i)).toBeInTheDocument();
  });

  it('shows placeholder when no sections yet', () => {
    render(<SectionedPreview sections={[]} sectionsTotal={0} statusText="" />);
    expect(screen.getByText(/generating first section/i)).toBeInTheDocument();
  });

  it('shows statusText in the header', () => {
    render(<SectionedPreview sections={[makeDoc('X')]} sectionsTotal={3} statusText="Drafting" />);
    expect(screen.getByText('Drafting')).toBeInTheDocument();
  });
});
