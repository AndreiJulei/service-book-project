import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AuthPage } from './AuthPage';
import { authService } from '../authService';
import * as router from 'react-router';

// Mock react-router
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}));

// Mock authService
vi.mock('../authService', () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    getAccessToken: vi.fn(),
    getAuthHeaders: vi.fn(),
    getCurrentUser: vi.fn(),
    isAuthenticated: vi.fn(),
    hasRole: vi.fn(),
  },
}));

describe('AuthPage component', () => {
  const mockNavigate = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    vi.spyOn(router, 'useNavigate').mockReturnValue(mockNavigate);
  });

  it('renders login form by default', () => {
    render(<AuthPage />);
    expect(screen.getByText('Welcome Back')).toBeDefined();
    expect(screen.getByPlaceholderText('Email Address')).toBeDefined();
    expect(screen.getByPlaceholderText('Password')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDefined();
  });

  it('switches to signup form when clicking the signup button', async () => {
    render(<AuthPage />);
    const toggleButton = screen.getByText('New to Forest & Flow? Create an Account');
    fireEvent.click(toggleButton);

    expect(screen.getByRole('heading', { name: 'Create Account' })).toBeDefined();
    expect(screen.getByPlaceholderText('Username')).toBeDefined();
    expect(screen.getByPlaceholderText('Phone Number')).toBeDefined();
    expect(screen.getByPlaceholderText('Confirm Password')).toBeDefined();
  });

  it('handles client login with valid credentials', async () => {
    const mockUser = { id: 1, username: 'clientuser', email: 'client@test.com', roles: ['client'] };
    vi.spyOn(authService, 'login').mockResolvedValue({
      user: mockUser,
      access_token: 'valid_access_token',
      refresh_token: 'valid_refresh_token',
    });

    render(<AuthPage />);
    
    fireEvent.change(screen.getByPlaceholderText('Email Address'), { target: { value: 'client@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith('client@test.com', 'password123');
      expect(mockNavigate).toHaveBeenCalledWith('/client/search');
    });
  });

  it('handles client login with incorrect role and logs out', async () => {
    const mockUser = { id: 1, username: 'adminuser', email: 'admin@test.com', roles: ['admin'] };
    vi.spyOn(authService, 'login').mockResolvedValue({
      user: mockUser,
      access_token: 'valid_access_token',
      refresh_token: 'valid_refresh_token',
    });
    const logoutSpy = vi.spyOn(authService, 'logout').mockResolvedValue();
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<AuthPage />);
    
    fireEvent.change(screen.getByPlaceholderText('Email Address'), { target: { value: 'admin@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith('admin@test.com', 'password123');
      expect(logoutSpy).toHaveBeenCalled();
      expect(alertSpy).toHaveBeenCalledWith('You do not have permission to access the Client Portal.');
    });
  });

  it('handles client signup successfully', async () => {
    vi.spyOn(authService, 'register').mockResolvedValue({
      user: { id: 2, username: 'newclient', email: 'newclient@test.com', roles: ['client'] },
      access_token: 'access',
      refresh_token: 'refresh',
    });

    render(<AuthPage />);
    
    // Switch to signup
    fireEvent.click(screen.getByText('New to Forest & Flow? Create an Account'));
    
    // Fill out form
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'newclient' } });
    fireEvent.change(screen.getByPlaceholderText('Email Address'), { target: { value: 'newclient@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Phone Number'), { target: { value: '1234567890' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(authService.register).toHaveBeenCalledWith('newclient', 'newclient@test.com', 'password123', 'client');
      expect(mockNavigate).toHaveBeenCalledWith('/client/search');
    });
  });

  it('validates password match during client signup', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    render(<AuthPage />);
    
    // Switch to signup
    fireEvent.click(screen.getByText('New to Forest & Flow? Create an Account'));
    
    // Fill out mismatching passwords
    fireEvent.change(screen.getByPlaceholderText('Username'), { target: { value: 'newclient' } });
    fireEvent.change(screen.getByPlaceholderText('Email Address'), { target: { value: 'newclient@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Phone Number'), { target: { value: '1234567890' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } });
    fireEvent.change(screen.getByPlaceholderText('Confirm Password'), { target: { value: 'password456' } });
    
    fireEvent.click(screen.getByRole('button', { name: 'Create Account' }));

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Passwords do not match');
      expect(authService.register).not.toHaveBeenCalled();
    });
  });

  it('renders firm login page correctly', () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Firm Sign-In'));

    expect(screen.getByText('Business Portal')).toBeDefined();
    expect(screen.getByPlaceholderText('Business Email')).toBeDefined();
    expect(screen.getByPlaceholderText('Password')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Access Dashboard' })).toBeDefined();
  });

  it('handles firm login with valid credentials', async () => {
    const mockUser = { id: 1, username: 'adminuser', email: 'admin@test.com', roles: ['admin'] };
    vi.spyOn(authService, 'login').mockResolvedValue({
      user: mockUser,
      access_token: 'valid_access_token',
      refresh_token: 'valid_refresh_token',
    });

    render(<AuthPage />);
    fireEvent.click(screen.getByText('Firm Sign-In'));
    
    fireEvent.change(screen.getByPlaceholderText('Business Email'), { target: { value: 'admin@test.com' } });
    fireEvent.change(screen.getByPlaceholderText('Password'), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByRole('button', { name: 'Access Dashboard' }));

    await waitFor(() => {
      expect(authService.login).toHaveBeenCalledWith('admin@test.com', 'password123');
      expect(mockNavigate).toHaveBeenCalledWith('/firm/dashboard');
    });
  });

  it('renders employee code join form correctly', () => {
    render(<AuthPage />);
    fireEvent.click(screen.getByText('Employee Join'));

    expect(screen.getByText('Employee Access')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Join Workspace' })).toBeDefined();
  });
});
