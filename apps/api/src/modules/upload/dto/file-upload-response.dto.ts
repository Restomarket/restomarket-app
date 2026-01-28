import { ApiProperty } from '@nestjs/swagger';

/**
 * Response DTO for file upload operations
 */
export class FileUploadResponseDto {
  @ApiProperty({
    description: 'Original filename',
    example: 'document.pdf',
  })
  originalName: string;

  @ApiProperty({
    description: 'File encoding',
    example: '7bit',
  })
  encoding: string;

  @ApiProperty({
    description: 'File MIME type',
    example: 'application/pdf',
  })
  mimetype: string;

  @ApiProperty({
    description: 'File size in bytes',
    example: 1024000,
  })
  size: number;

  @ApiProperty({
    description: 'Field name from the form',
    example: 'file',
  })
  fieldname: string;

  constructor(file: Express.Multer.File) {
    this.originalName = file.originalname;
    this.encoding = file.encoding;
    this.mimetype = file.mimetype;
    this.size = file.size;
    this.fieldname = file.fieldname;
  }
}

/**
 * Response DTO for multiple file uploads
 */
export class MultipleFileUploadResponseDto {
  @ApiProperty({
    description: 'Array of uploaded files',
    type: [FileUploadResponseDto],
  })
  files: FileUploadResponseDto[];

  @ApiProperty({
    description: 'Total number of files uploaded',
    example: 3,
  })
  count: number;

  @ApiProperty({
    description: 'Total size of all files in bytes',
    example: 3072000,
  })
  totalSize: number;

  constructor(files: Express.Multer.File[]) {
    this.files = files.map(file => new FileUploadResponseDto(file));
    this.count = files.length;
    this.totalSize = files.reduce((sum, file) => sum + file.size, 0);
  }
}
