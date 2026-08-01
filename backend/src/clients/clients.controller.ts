import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto, UpdateClientDto } from './dto/client.dto';

@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(@Query('search') search?: string) {
    return this.clientsService.findAll(search);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.clientsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateClientDto) {
    return this.clientsService.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateClientDto) {
    return this.clientsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.clientsService.remove(id);
  }
}
