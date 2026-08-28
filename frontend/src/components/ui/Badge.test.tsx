// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('renders its content with the tone class', () => {
    render(<Badge tone="success">Active</Badge>);
    expect(screen.getByText('Active').className).toContain('text-success');
  });
});
