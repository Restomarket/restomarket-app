import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home Page', () => {
  it('renders without crashing', () => {
    render(<Home />);
    expect(document.body).toBeInTheDocument();
  });

  it('renders the getting started text', () => {
    render(<Home />);
    const text = screen.getByText(/Get started by editing/i);
    expect(text).toBeInTheDocument();
  });

  it('renders the deploy button', () => {
    render(<Home />);
    const button = screen.getByText(/Deploy now/i);
    expect(button).toBeInTheDocument();
  });
});
