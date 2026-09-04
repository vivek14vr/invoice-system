import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Prisma } from '../generated/prisma/client';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const request = host.switchToHttp().getRequest<Request>();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Unable to complete this request. Please try again.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const payload = exception.getResponse();
      if (typeof payload === 'string') message = payload;
      else if (payload && typeof payload === 'object' && 'message' in payload) {
        const value = (payload as { message?: string | string[] }).message;
        message = Array.isArray(value) ? value.join(', ') : value ?? message;
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = HttpStatus.BAD_REQUEST;
        message = 'A record with these details already exists.';
      } else if (exception.code === 'P2025') {
        status = HttpStatus.NOT_FOUND;
        message = 'The requested record was not found.';
      } else if (exception.code === 'P2003') {
        status = HttpStatus.BAD_REQUEST;
        message = 'This record cannot be changed because it is still in use.';
      }
    } else if (exception instanceof Error && exception.message) {
      this.logger.error(`${request.method} ${request.url}: ${exception.message}`, exception.stack);
    } else {
      this.logger.error(`${request.method} ${request.url}: Unknown error`, String(exception));
    }

    response.status(status).json({
      message,
      error: HttpStatus[status] ?? 'Error',
      statusCode: status,
    });
  }
}
