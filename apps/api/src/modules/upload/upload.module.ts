import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { memoryStorage } from 'multer';

/**
 * Upload Module
 *
 * Provides file upload capabilities across the application.
 * Configured to use memory storage for processing files in memory.
 *
 * Usage:
 * 1. Import UploadModule in your feature module
 * 2. Use the file interceptors and validation pipes in your controllers
 *
 * @example
 * ```typescript
 * import { FileInterceptor } from '@nestjs/platform-express';
 * import { FileValidationPipes } from '@/modules/upload/pipes';
 *
 * @Post('upload')
 * @UseInterceptors(FileInterceptor('file'))
 * uploadFile(
 *   @UploadedFile(FileValidationPipes.image()) file: Express.Multer.File
 * ) {
 *   return { filename: file.originalname };
 * }
 * ```
 */
@Module({
  imports: [
    MulterModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        // Use memory storage - files stored as Buffer in memory
        // No files are written to disk
        storage: memoryStorage(),

        // Global file size limit (can be overridden in individual routes)
        limits: {
          fileSize: configService.get<number>('UPLOAD_MAX_FILE_SIZE') ?? 10 * 1024 * 1024, // 10MB default
        },

        // Preserve original filename
        preservePath: false,
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [MulterModule],
})
export class UploadModule {}
