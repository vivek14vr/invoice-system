import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { SESSION_COOKIE } from './auth.constants';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ADMIN_ONLY_KEY } from './admin.decorator';
import { ForbiddenException } from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
    const user = await this.authService.validateSession(token);
    if (!user) throw new UnauthorizedException('Authentication required');
    if (!user.companyId) {
      throw new UnauthorizedException('An active workspace is required');
    }
    const adminOnly = this.reflector.getAllAndOverride<boolean>(
      ADMIN_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (adminOnly && user.role !== 'ADMIN')
      throw new ForbiddenException('Administrator access required');
    if (user.workspace?.isRestricted && !request.path.startsWith('/auth/')) {
      throw new ForbiddenException('This workspace is restricted');
    }
    if (
      user.role === 'READ_ONLY' &&
      request.method !== 'GET' &&
      request.path !== '/auth/logout'
    ) {
      throw new ForbiddenException('Read-only users cannot modify data');
    }
    Object.assign(request, { user });
    return true;
  }
}
