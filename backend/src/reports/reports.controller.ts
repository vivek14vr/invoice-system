import { Controller, Get, Query, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ReportsService } from './reports.service';
import type { ReportType } from './reports.service';

type AuthenticatedRequest = Request & { user: { companyId?: string | null } };

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get()
  summary(
    @Req() request: AuthenticatedRequest,
    @Query('type') type?: ReportType,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    return this.reports.build(request.user.companyId, type, dateFrom, dateTo);
  }

  @Get('export')
  async exportCsv(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
    @Query('type') type?: ReportType,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    const csv = await this.reports.csv(
      request.user.companyId,
      type,
      dateFrom,
      dateTo,
    );
    response.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="invoice-report.csv"',
    });
    response.send(csv);
  }
}
