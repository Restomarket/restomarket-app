import { render, screen } from '@testing-library/react';
import { Button } from './button';

describe('Button', () => {
  it('renders the children', () => {
    render(<Button appName="test">Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
