import { Module } from '@nestjs/common';
import { ExpensesController } from './expenses.controller';
import { ExpensesService } from './expenses.service';
import { GridFsService } from '../files/gridfs.service';

@Module({
  controllers: [ExpensesController],
  providers: [ExpensesService, GridFsService],
})
export class ExpensesModule {}
