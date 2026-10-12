import { ExecutionContext } from '@nestjs/common';
import { SupabaseService } from '../../supabase/supabase.service';
import { AiErrorException } from '../errors/ai-error.exception';
import { AuthenticatedRequest, SupabaseAuthGuard } from './supabase-auth.guard';

function buildGuard(getUser: jest.Mock | null): SupabaseAuthGuard {
  const supabaseService = {
    getClient: () => (getUser ? { auth: { getUser } } : null),
  } as unknown as SupabaseService;

  return new SupabaseAuthGuard(supabaseService);
}

function buildContext(authorization?: string): {
  context: ExecutionContext;
  request: AuthenticatedRequest;
} {
  const request = { headers: { authorization } } as AuthenticatedRequest;
  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;

  return { context, request };
}

describe('SupabaseAuthGuard', () => {
  it('rejects requests without a Bearer token', async () => {
    const guard = buildGuard(jest.fn());

    await expect(
      guard.canActivate(buildContext().context),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('rejects non-Bearer authorization schemes', async () => {
    const guard = buildGuard(jest.fn());

    await expect(
      guard.canActivate(buildContext('Basic abc').context),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('attaches the authenticated user when the token is valid', async () => {
    const getUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'user-1', email: 'user@example.com' } },
      error: null,
    });
    const guard = buildGuard(getUser);
    const { context, request } = buildContext('Bearer valid-token');

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(getUser).toHaveBeenCalledWith('valid-token');
    expect(request.user).toEqual({
      id: 'user-1',
      email: 'user@example.com',
    });
  });

  it('rejects invalid or expired tokens', async () => {
    const getUser = jest.fn().mockResolvedValue({
      data: { user: null },
      error: new Error('invalid token'),
    });
    const guard = buildGuard(getUser);

    await expect(
      guard.canActivate(buildContext('Bearer expired').context),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('fails with 503 when Supabase is not configured', async () => {
    const guard = buildGuard(null);

    const error = await guard
      .canActivate(buildContext('Bearer token').context)
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(AiErrorException);
    expect((error as AiErrorException).getStatus()).toBe(503);
    expect((error as AiErrorException).code).toBe('PROVIDER_UNAVAILABLE');
  });
});
