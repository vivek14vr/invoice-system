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
  user: { id: string; email: string; name: string };
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const forwarded = request.headers['x-forwarded-for'];
    const ip = Array.isArray(forwarded)
      ? forwarded[0]
      : forwarded?.split(',')[0]?.trim() || request.ip || 'unknown';
    const result = await this.authService.login(dto.email, dto.password, ip);
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
  users() {
    return this.authService.listUsers();
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
      companyId?: string;
    },
  ) {
    return this.authService.createUser(dto);
  }

  @Delete('users/:id')
  @AdminOnly()
  removeUser(@Param('id') id: string) {
    return this.authService.removeUser(id);
  }

  @Get('companies')
  @AdminOnly()
  companies() {
    return this.authService.listCompanies();
  }

  @Post('companies')
  @AdminOnly()
  createCompany(@Body() dto: { name: string }) {
    return this.authService.createCompany(dto.name);
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
