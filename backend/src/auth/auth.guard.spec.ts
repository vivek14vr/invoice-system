import { ExecutionContext } from '@nestjs/common';
jest.mock('./auth.service', () => ({}));
import { AuthGuard } from './auth.guard';

describe('AuthGuard workspace enforcement', () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const authService = {
    validateSession: jest.fn(),
  };
  const guard = new AuthGuard(reflector as never, authService as never);

  function context(request: Record<string, unknown>) {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
  });

  it('allows an authenticated request with an active workspace', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      role: 'READ_ONLY' as const,
      companyId: 'workspace-1',
    };
    authService.validateSession.mockResolvedValue(user);
    const request = {
      cookies: { session: 'token' },
      method: 'GET',
      path: '/clients',
    };

    await expect(guard.canActivate(context(request))).resolves.toBe(true);
    expect(request.user).toEqual(user);
  });

  it('rejects an authenticated request without an active workspace', async () => {
    authService.validateSession.mockResolvedValue({
      id: 'user-1',
      email: 'user@example.com',
      name: 'User',
      role: 'READ_ONLY',
      companyId: null,
    });

    await expect(
      guard.canActivate(
        context({ cookies: { session: 'token' }, method: 'GET', path: '/clients' }),
      ),
    ).rejects.toThrow('An active workspace is required');
  });

  it('rejects protected data access for a restricted workspace', async () => {
    const user = {
      id: 'admin-1',
      email: 'admin@girjasoft.com',
      name: 'Administrator',
      role: 'ADMIN' as const,
      companyId: 'workspace-1',
      workspace: { id: 'workspace-1', name: 'Demo', isRestricted: true },
    };
    authService.validateSession.mockResolvedValue(user);

    await expect(
      guard.canActivate(
        context({ cookies: { session: 'token' }, method: 'GET', path: '/clients' }),
      ),
    ).rejects.toThrow('This workspace is restricted');
  });
});
