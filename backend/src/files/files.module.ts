import { Module } from '@nestjs/common';
import { GridFsService } from './gridfs.service';

@Module({
  providers: [GridFsService],
  exports: [GridFsService],
})
export class FilesModule {}
