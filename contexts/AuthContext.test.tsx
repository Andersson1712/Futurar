import { act, render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';

type AuthChangeHandler = (event: string, session: unknown) => void;

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithPassword: vi.fn(),
  signUp: vi.fn(),
  signOut: vi.fn(),
  unsubscribe: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock('../services/supabase', () => ({
  supabase: {
    from: mocks.from,
    rpc: mocks.rpc,
    auth: {
      getSession: mocks.getSession,
      onAuthStateChange: mocks.onAuthStateChange,
      signInWithPassword: mocks.signInWithPassword,
      signUp: mocks.signUp,
      signOut: mocks.signOut,
    },
  },
}));

type AuthValue = ReturnType<typeof useAuth>;

let auth: AuthValue | null = null;

function Probe() {
  auth = useAuth();
  return null;
}

function current(): AuthValue {
  if (!auth) {
    throw new Error('AuthProvider did not render');
  }
  return auth;
}

async function renderProvider(): Promise<void> {
  render(
    <AuthProvider>
      <Probe />
    </AuthProvider>,
  );

  await waitFor(() => expect(current().isLoading).toBe(false));
}

describe('AuthContext (SPEC-034)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    auth = null;

    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: mocks.unsubscribe } },
    });
    mocks.signOut.mockResolvedValue({ error: null });
  });

  it('is authenticated when getSession returns a session', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    });

    await renderProvider();

    expect(current().isAuthenticated).toBe(true);
  });

  it('is not authenticated when getSession returns no session', async () => {
    await renderProvider();

    expect(current().isAuthenticated).toBe(false);
  });

  it('follows the SIGNED_IN and SIGNED_OUT events', async () => {
    const handlers: AuthChangeHandler[] = [];

    mocks.onAuthStateChange.mockImplementation((callback: AuthChangeHandler) => {
      handlers.push(callback);
      return { data: { subscription: { unsubscribe: mocks.unsubscribe } } };
    });

    await renderProvider();
    expect(current().isAuthenticated).toBe(false);

    act(() => {
      for (const handler of handlers) {
        handler('SIGNED_IN', { user: { id: 'user-1' } });
      }
    });

    expect(current().isAuthenticated).toBe(true);

    act(() => {
      for (const handler of handlers) {
        handler('SIGNED_OUT', null);
      }
    });

    expect(current().isAuthenticated).toBe(false);
  });

  it('forwards the display name to signUp metadata', async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: null },
      error: null,
    });

    await renderProvider();

    let result = false;
    await act(async () => {
      result = await current().register('ana@example.com', 'secret-1', 'Ana');
    });

    expect(result).toBe(true);
    expect(mocks.signUp).toHaveBeenCalledWith({
      email: 'ana@example.com',
      password: 'secret-1',
      options: { data: { name: 'Ana' } },
    });
  });

  it('surfaces the auth error when signUp fails', async () => {
    mocks.signUp.mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Email already registered' },
    });

    await renderProvider();

    let result = true;
    await act(async () => {
      result = await current().register('ana@example.com', 'secret-1', 'Ana');
    });

    expect(result).toBe(false);
    expect(current().error).toBe('Email already registered');
  });

  it('never reads or writes tables through the client', async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: 'user-1' } } },
    });
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: { user: { id: 'user-1' } } },
      error: null,
    });
    mocks.signUp.mockResolvedValue({
      data: { user: { id: 'user-1' }, session: null },
      error: null,
    });

    await renderProvider();

    let loginResult = false;
    await act(async () => {
      loginResult = await current().login('ana@example.com', 'secret-1');
    });

    expect(loginResult).toBe(true);

    await act(async () => {
      await current().logout();
    });

    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
