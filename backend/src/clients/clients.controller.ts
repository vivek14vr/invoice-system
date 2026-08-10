import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';
type AuthenticatedRequest = Request & { user: { companyId?: string | null } };

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(
    @Req() request: AuthenticatedRequest,
    @Query('search') search?: string,
  ) {
    return this.clientsService.findAll(search, request.user.companyId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.clientsService.findOne(id, request.user.companyId);
  }

  @Post()
  create(@Body() dto: CreateClientDto, @Req() request: AuthenticatedRequest) {
    return this.clientsService.create(dto, request.user.companyId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.clientsService.update(id, dto, request.user.companyId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() request: AuthenticatedRequest) {
    return this.clientsService.remove(id, request.user.companyId);
  }
}
