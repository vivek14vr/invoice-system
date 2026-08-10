import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getOverview(
    @Req() request: Request & { user: { companyId?: string | null } },
  ) {
    return this.dashboardService.getOverview(request.user.companyId);
  }
}
