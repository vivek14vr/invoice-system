import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Post,
  Param,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { SESSION_COOKIE, SESSION_DURATION_MS } from './auth.constants';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';
import { AdminOnly } from './admin.decorator';

type AuthenticatedRequest = Request & {
  user: { id: string; email: string; name: string; companyId?: string | null };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.authService.login(dto.email, dto.password);
    response.cookie(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: SESSION_DURATION_MS,
      path: '/',
    });
    return { user: result.user, expiresAt: result.expiresAt };
  }

  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return { user: request.user };
  }

  @Get('users')
  @AdminOnly()
  users(@Req() request: AuthenticatedRequest) {
    return this.authService.listUsers(request.user.companyId);
  }

  @Post('users')
  @AdminOnly()
  createUser(
    @Body()
    dto: {
      email: string;
      name: string;
      password: string;
      role?: 'ADMIN' | 'READ_ONLY';
    },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.createUser(dto, request.user.companyId);
  }

  @Delete('users/:id')
  @AdminOnly()
  removeUser(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.authService.removeUser(
      id,
      request.user.id,
      request.user.companyId,
    );
  }

  @Get('workspaces')
  workspaces(@Req() request: AuthenticatedRequest) {
    return this.authService.listWorkspaces(request.user.id);
  }

  @Post('workspaces')
  @AdminOnly()
  createWorkspace(
    @Body() dto: { name: string },
    @Req() request: AuthenticatedRequest,
  ) {
    return this.authService.createWorkspace(request.user.id, dto.name);
  }

  @Post('switch-workspace')
  async switchWorkspace(
    @Body() dto: { companyId: string },
    @Req() request: AuthenticatedRequest,
  ) {
    const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
    const user = await this.authService.switchWorkspace(
      request.user.id,
      token,
      dto.companyId,
    );
    return { user };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const token = request.cookies?.[SESSION_COOKIE] as string | undefined;
    await this.authService.logout(token);
    response.clearCookie(SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.COOKIE_SECURE === 'true',
      path: '/',
    });
  }
}
