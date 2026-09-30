import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AiErrorException } from '../errors/ai-error.exception';
import { SupabaseService } from '../../supabase/supabase.service';

export interface AuthenticatedUser {
  id: string;
  email?: string;
}

export type AuthenticatedRequest = Request & { user?: AuthenticatedUser };

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new AiErrorException(401, 'UNAUTHORIZED', 'Missing Bearer token');
    }

    const client = this.supabaseService.getClient();
    if (!client) {
      throw new AiErrorException(
        503,
        'PROVIDER_UNAVAILABLE',
        'Authentication provider is not configured',
      );
    }

    const { data, error } = await client.auth.getUser(token);

    if (error || !data.user) {
      throw new AiErrorException(
        401,
        'UNAUTHORIZED',
        'Invalid or expired token',
      );
    }

    request.user = {
      id: data.user.id,
      email: data.user.email ?? undefined,
    };

    return true;
  }
}

export function extractBearerToken(header?: string): string | undefined {
  if (!header) return undefined;

  const [scheme, token] = header.split(' ');

  if (scheme?.toLowerCase() !== 'bearer' || !token) return undefined;

  return token;
}
