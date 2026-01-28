# How to Use Upload Module in Your Controllers

This guide shows you exactly how to add file upload functionality to any controller in your NestJS application.

## Step 1: Import UploadModule in Your Feature Module

```typescript
// src/modules/documents/documents.module.ts
import { Module } from '@nestjs/common';
import { UploadModule } from '@/modules/upload';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  imports: [UploadModule], // ← Add this line
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}
```

## Step 2: Use in Your Controller

### Example 1: Simple Document Upload

```typescript
// src/modules/documents/documents.controller.ts
import { Controller, Post, UseInterceptors } from '@nestjs/common';
import { ApiTags, ApiConsumes, ApiBody, ApiOperation } from '@nestjs/swagger';
import { FileInterceptor, UploadedFile, FileValidationPipes } from '@/modules/upload';

@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a document' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Document file to upload (PDF, DOC, DOCX, XLS, XLSX)',
        },
      },
    },
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadDocument(@UploadedFile(FileValidationPipes.document()) file: Express.Multer.File) {
    // Process the file - save to storage, database, etc.
    const result = await this.documentsService.saveDocument(file);

    return {
      message: 'Document uploaded successfully',
      document: result,
    };
  }
}
```

### Example 2: Avatar Upload for Users

```typescript
// src/modules/users/users.controller.ts
import { Controller, Post, UseInterceptors, Param } from '@nestjs/common';
import { FileInterceptor, UploadedFile, FileValidationPipes } from '@/modules/upload';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post(':id/avatar')
  @UseInterceptors(FileInterceptor('avatar'))
  async uploadAvatar(
    @Param('id') id: string,
    @UploadedFile(FileValidationPipes.image(2 * 1024 * 1024)) // 2MB limit
    avatar: Express.Multer.File,
  ) {
    // Upload to cloud storage (S3, Azure Blob, etc.)
    const avatarUrl = await this.usersService.updateAvatar(id, avatar);

    return {
      message: 'Avatar updated successfully',
      avatarUrl,
    };
  }
}
```

### Example 3: Multiple Files Upload

```typescript
// src/modules/gallery/gallery.controller.ts
import { Controller, Post, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor, UploadedFiles, FileValidationPipes } from '@/modules/upload';

@Controller('gallery')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Post('upload')
  @UseInterceptors(FilesInterceptor('images', 10)) // Max 10 images
  async uploadImages(@UploadedFiles(FileValidationPipes.image()) images: Express.Multer.File[]) {
    const savedImages = await this.galleryService.saveImages(images);

    return {
      message: `${images.length} images uploaded successfully`,
      images: savedImages,
    };
  }
}
```

### Example 4: CSV Import

```typescript
// src/modules/products/products.controller.ts
import { Controller, Post, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, UploadedFile, FileValidationPipes } from '@/modules/upload';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post('import')
  @UseInterceptors(FileInterceptor('file'))
  async importProducts(@UploadedFile(FileValidationPipes.csv()) file: Express.Multer.File) {
    // Parse CSV and import products
    const result = await this.productsService.importFromCsv(file.buffer);

    return {
      message: 'Products imported successfully',
      imported: result.count,
      errors: result.errors,
    };
  }
}
```

### Example 5: PDF Reports

```typescript
// src/modules/reports/reports.controller.ts
import { Controller, Post, UseInterceptors } from '@nestjs/common';
import { FileInterceptor, UploadedFile, FileValidationPipes } from '@/modules/upload';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('report'))
  async uploadReport(
    @UploadedFile(FileValidationPipes.pdf(15 * 1024 * 1024)) // 15MB limit
    report: Express.Multer.File,
  ) {
    // Process PDF report
    const result = await this.reportsService.processReport(report);

    return {
      message: 'Report uploaded and processed',
      reportId: result.id,
    };
  }
}
```

## Step 3: Process Files in Your Service

### Example Service Implementation

```typescript
// src/modules/documents/documents.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class DocumentsService {
  async saveDocument(file: Express.Multer.File) {
    // Access file properties
    const {
      buffer, // File content as Buffer
      originalname, // Original filename
      mimetype, // MIME type
      size, // Size in bytes
    } = file;

    // Option 1: Upload to cloud storage (S3, Azure Blob, etc.)
    // const url = await this.storageService.upload(buffer, originalname);

    // Option 2: Save to file system
    // await fs.writeFile(`./uploads/${originalname}`, buffer);

    // Option 3: Process in memory (e.g., parse, transform)
    // const processed = await this.processBuffer(buffer);

    // Return result
    return {
      filename: originalname,
      size,
      mimetype,
      // url, // If uploaded to cloud
    };
  }

  async updateAvatar(userId: string, avatar: Express.Multer.File) {
    // Upload avatar to storage service
    const avatarUrl = await this.uploadToS3(avatar.buffer, avatar.originalname);

    // Update user record in database
    // await this.userRepository.update(userId, { avatarUrl });

    return avatarUrl;
  }

  async saveImages(images: Express.Multer.File[]) {
    // Process multiple images
    const promises = images.map(async image => {
      const url = await this.uploadToStorage(image.buffer, image.originalname);
      return {
        filename: image.originalname,
        url,
        size: image.size,
      };
    });

    return Promise.all(promises);
  }

  async importFromCsv(buffer: Buffer) {
    // Parse CSV
    const csvContent = buffer.toString('utf-8');
    const rows = csvContent.split('\n');

    // Process rows
    const results = {
      count: 0,
      errors: [],
    };

    for (const row of rows) {
      try {
        // Parse and save each row
        // await this.createProduct(parseRow(row));
        results.count++;
      } catch (error) {
        results.errors.push({ row, error: error.message });
      }
    }

    return results;
  }

  async processReport(report: Express.Multer.File) {
    // Process PDF report
    // const text = await this.extractTextFromPdf(report.buffer);
    // const analysis = await this.analyzeReport(text);

    return {
      id: 'report-123',
      // analysis,
    };
  }

  private async uploadToS3(buffer: Buffer, filename: string): Promise<string> {
    // Implement S3 upload logic
    return `https://s3.amazonaws.com/bucket/${filename}`;
  }

  private async uploadToStorage(buffer: Buffer, filename: string): Promise<string> {
    // Implement storage upload logic
    return `https://storage.example.com/${filename}`;
  }
}
```

## Available Validation Pipes

### Pre-configured Pipes

```typescript
// Images (JPEG, PNG, GIF, WEBP, SVG) - 5MB default
FileValidationPipes.image();
FileValidationPipes.image(2 * 1024 * 1024); // Custom 2MB

// Documents (PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, TXT, CSV) - 10MB default
FileValidationPipes.document();
FileValidationPipes.document(20 * 1024 * 1024); // Custom 20MB

// PDF only - 10MB default
FileValidationPipes.pdf();

// CSV only - 5MB default
FileValidationPipes.csv();

// Archives (ZIP, RAR, TAR, GZIP) - 50MB default
FileValidationPipes.archive();

// Media (MP4, MP3, WAV, AVI, MOV) - 100MB default
FileValidationPipes.media();
```

### Custom Validation

```typescript
import { createFileValidationPipe } from '@/modules/upload';

@UploadedFile(
  createFileValidationPipe({
    maxSize: 5 * 1024 * 1024, // 5MB
    fileTypes: ['image/jpeg', 'image/png', 'application/pdf'],
    fileIsRequired: true,
    errorHttpStatusCode: 400,
  })
)
```

## File Properties

When you receive a file, you have access to:

```typescript
file.buffer; // File content as Buffer
file.originalname; // Original filename (e.g., "document.pdf")
file.mimetype; // MIME type (e.g., "application/pdf")
file.size; // Size in bytes
file.fieldname; // Form field name (e.g., "file")
file.encoding; // File encoding (e.g., "7bit")
```

## Error Handling

The module automatically throws appropriate HTTP exceptions:

```typescript
// File too large
{
  "statusCode": 422,
  "message": "File size must not exceed 5.00 MB. Received: 7.50 MB",
  "error": "Unprocessable Entity"
}

// Invalid file type
{
  "statusCode": 422,
  "message": "File type must be one of: image/jpeg, image/png. Received: image/gif",
  "error": "Unprocessable Entity"
}
```

## Testing

```typescript
// documents.controller.spec.ts
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { UploadModule } from '@/modules/upload';

describe('DocumentsController', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [UploadModule],
      controllers: [DocumentsController],
      providers: [DocumentsService],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  it('should upload a document', () => {
    const fileBuffer = Buffer.from('test file content');

    return request(app.getHttpServer())
      .post('/documents/upload')
      .attach('file', fileBuffer, 'test.pdf')
      .expect(201)
      .expect(res => {
        expect(res.body.message).toBe('Document uploaded successfully');
      });
  });
});
```

## Best Practices

### ✅ DO

```typescript
// ✅ Always validate files
@UploadedFile(FileValidationPipes.image()) file: Express.Multer.File

// ✅ Set appropriate size limits
FileValidationPipes.image(2 * 1024 * 1024) // 2MB for avatars

// ✅ Use specific file types
FileValidationPipes.pdf() // Only PDFs

// ✅ Handle errors properly
try {
  const result = await this.service.saveFile(file);
  return { success: true, result };
} catch (error) {
  throw new BadRequestException('Failed to save file');
}
```

### ❌ DON'T

```typescript
// ❌ Don't skip validation
@UploadedFile() file: Express.Multer.File // No validation!

// ❌ Don't allow unlimited file sizes
// Use appropriate limits for your use case

// ❌ Don't save files to disk in the controller
// Process in memory or use a service

// ❌ Don't forget to handle the buffer
// Files are in memory, process them appropriately
```

## Summary

1. **Import** `UploadModule` in your feature module
2. **Use** `FileInterceptor` or `FilesInterceptor` in your controller
3. **Validate** with `FileValidationPipes` or custom validation
4. **Process** files in your service layer
5. **Return** appropriate responses

That's it! You now have a fully functional, production-ready file upload system that can be used across all your controllers! 🎉
