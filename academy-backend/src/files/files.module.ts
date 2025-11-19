import { Module } from '@nestjs/common';
import { FilesController } from './files.controller';
import { AdminFilesController } from './admin-files.controller';
import { FilesService } from './files.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [FilesController, AdminFilesController],
  providers: [FilesService],
  exports: [FilesService],
})
export class FilesModule {}
