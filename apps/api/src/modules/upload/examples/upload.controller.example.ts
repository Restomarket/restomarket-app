/**
 * EXAMPLE CONTROLLER - Usage demonstrations for the Upload Module
 *
 * This file shows various ways to use the upload module in your controllers.
 * Copy the examples you need into your actual controllers.
 *
 * DO NOT import this file directly - it's for reference only.
 */

import {
  Controller,
  Post,
  UseInterceptors,
  Body,
  HttpStatus,
  ParseFilePipeBuilder,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody, ApiResponse } from '@nestjs/swagger';
import {
  FileInterceptor,
  FilesInterceptor,
  FileFieldsInterceptor,
  UploadedFile,
  UploadedFiles,
  FileValidationPipes,
  createFileValidationPipe,
  FileUploadResponseDto,
  MultipleFileUploadResponseDto,
  FileTransformInterceptor,
} from '../index';

@ApiTags('Upload Examples')
@Controller('examples/upload')
export class UploadExampleController {
  /**
   * Example 1: Simple single file upload with image validation
   */
  @Post('image')
  @ApiOperation({ summary: 'Upload a single image file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Image file (JPEG, PNG, GIF, WEBP, SVG)',
        },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Image uploaded successfully',
    type: FileUploadResponseDto,
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadImage(
    @UploadedFile(FileValidationPipes.image())
    file: Express.Multer.File,
  ): FileUploadResponseDto {
    // File is validated: JPEG, PNG, GIF, WEBP, SVG, max 5MB
    return new FileUploadResponseDto(file);
  }

  /**
   * Example 2: Document upload with custom size limit
   */
  @Post('document')
  @ApiOperation({ summary: 'Upload a document file' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document file (PDF, DOC, DOCX, XLS, XLSX, etc.)',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadDocument(
    @UploadedFile(FileValidationPipes.document(15 * 1024 * 1024)) // 15MB
    file: Express.Multer.File,
  ) {
    return {
      message: 'Document uploaded successfully',
      file: {
        name: file.originalname,
        size: file.size,
        type: file.mimetype,
      },
    };
  }

  /**
   * Example 3: PDF only upload
   */
  @Post('pdf')
  @ApiOperation({ summary: 'Upload a PDF file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadPdf(@UploadedFile(FileValidationPipes.pdf()) file: Express.Multer.File) {
    // Process PDF
    return {
      filename: file.originalname,
      pages: 'Calculate pages from buffer if needed',
    };
  }

  /**
   * Example 4: Multiple files upload
   */
  @Post('multiple')
  @ApiOperation({ summary: 'Upload multiple image files' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Multiple image files',
        },
      },
    },
  })
  @UseInterceptors(FilesInterceptor('files', 5)) // Max 5 files
  uploadMultiple(
    @UploadedFiles(FileValidationPipes.image())
    files: Express.Multer.File[],
  ): MultipleFileUploadResponseDto {
    return new MultipleFileUploadResponseDto(files);
  }

  /**
   * Example 5: Multiple fields (different file types)
   */
  @Post('profile')
  @ApiOperation({ summary: 'Upload profile with avatar and documents' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        avatar: {
          type: 'string',
          format: 'binary',
          description: 'Profile avatar image',
        },
        documents: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: 'Profile documents',
        },
      },
    },
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'avatar', maxCount: 1 },
      { name: 'documents', maxCount: 3 },
    ]),
  )
  uploadProfile(
    @UploadedFiles()
    files: {
      avatar?: Express.Multer.File[];
      documents?: Express.Multer.File[];
    },
  ) {
    return {
      avatar: files.avatar?.[0]
        ? {
            name: files.avatar[0].originalname,
            size: files.avatar[0].size,
          }
        : null,
      documents: files.documents?.map(doc => ({
        name: doc.originalname,
        size: doc.size,
      })),
    };
  }

  /**
   * Example 6: Custom validation with createFileValidationPipe
   */
  @Post('custom')
  @ApiOperation({ summary: 'Upload with custom validation rules' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadCustom(
    @UploadedFile(
      createFileValidationPipe({
        maxSize: 3 * 1024 * 1024, // 3MB
        fileTypes: ['image/jpeg', 'image/png', 'application/pdf'],
        fileIsRequired: true,
        errorHttpStatusCode: HttpStatus.BAD_REQUEST,
      }),
    )
    file: Express.Multer.File,
  ) {
    return {
      message: 'Custom validation passed',
      file: file.originalname,
    };
  }

  /**
   * Example 7: Optional file upload with ParseFilePipeBuilder
   */
  @Post('optional')
  @ApiOperation({ summary: 'Optional file upload' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadOptional(
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: 'jpeg|png|pdf' })
        .addMaxSizeValidator({ maxSize: 5 * 1024 * 1024 })
        .build({
          errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
          fileIsRequired: false, // Make it optional
        }),
    )
    file?: Express.Multer.File,
  ) {
    if (!file) {
      return { message: 'No file uploaded' };
    }

    return {
      message: 'File uploaded',
      filename: file.originalname,
    };
  }

  /**
   * Example 8: File upload with additional body fields
   */
  @Post('with-metadata')
  @ApiOperation({ summary: 'Upload file with additional metadata' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        title: {
          type: 'string',
          example: 'My Document',
        },
        description: {
          type: 'string',
          example: 'Important document',
        },
        category: {
          type: 'string',
          example: 'legal',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  uploadWithMetadata(
    @UploadedFile(FileValidationPipes.document()) file: Express.Multer.File,
    @Body('title') title: string,
    @Body('description') description?: string,
    @Body('category') category?: string,
  ) {
    return {
      file: {
        name: file.originalname,
        size: file.size,
        mimetype: file.mimetype,
      },
      metadata: {
        title,
        description,
        category,
      },
    };
  }

  /**
   * Example 9: CSV file upload for data import
   */
  @Post('csv-import')
  @ApiOperation({ summary: 'Import data from CSV file' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  importCsv(@UploadedFile(FileValidationPipes.csv()) file: Express.Multer.File) {
    // Parse CSV from buffer
    const csvContent = file.buffer.toString('utf-8');
    const lines = csvContent.split('\n');

    return {
      message: 'CSV processed',
      rowCount: lines.length - 1, // Excluding header
      preview: lines.slice(0, 5),
    };
  }

  /**
   * Example 10: Archive file upload
   */
  @Post('archive')
  @ApiOperation({ summary: 'Upload archive file (ZIP, RAR, etc.)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadArchive(@UploadedFile(FileValidationPipes.archive()) file: Express.Multer.File) {
    return {
      message: 'Archive uploaded',
      filename: file.originalname,
      size: file.size,
      // You can extract/process the archive here
    };
  }

  /**
   * Example 11: Using FileTransformInterceptor for automatic DTO transformation
   */
  @Post('auto-transform')
  @ApiOperation({ summary: 'Upload with automatic response transformation' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'), FileTransformInterceptor)
  uploadAutoTransform(@UploadedFile(FileValidationPipes.image()) file: Express.Multer.File) {
    // Just return the file, interceptor will transform to FileUploadResponseDto
    return file;
  }

  /**
   * Example 12: Media file upload (video/audio)
   */
  @Post('media')
  @ApiOperation({ summary: 'Upload media file (video/audio)' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  uploadMedia(
    @UploadedFile(FileValidationPipes.media(50 * 1024 * 1024)) // 50MB
    file: Express.Multer.File,
  ) {
    return {
      message: 'Media file uploaded',
      filename: file.originalname,
      size: file.size,
      type: file.mimetype,
      duration: 'Extract duration if needed',
    };
  }
}
