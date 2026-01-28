/**
 * Supported file types for upload validation
 */
export enum FileType {
  // Images
  IMAGE_JPEG = 'image/jpeg',
  IMAGE_PNG = 'image/png',
  IMAGE_GIF = 'image/gif',
  IMAGE_WEBP = 'image/webp',
  IMAGE_SVG = 'image/svg+xml',

  // Documents
  PDF = 'application/pdf',
  DOC = 'application/msword',
  DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  XLS = 'application/vnd.ms-excel',
  XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  PPT = 'application/vnd.ms-powerpoint',
  PPTX = 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  TXT = 'text/plain',
  CSV = 'text/csv',

  // Archives
  ZIP = 'application/zip',
  RAR = 'application/x-rar-compressed',
  TAR = 'application/x-tar',
  GZIP = 'application/gzip',

  // Media
  MP4 = 'video/mp4',
  MP3 = 'audio/mpeg',
  WAV = 'audio/wav',
  AVI = 'video/x-msvideo',
  MOV = 'video/quicktime',

  // Other
  JSON = 'application/json',
  XML = 'application/xml',
}

/**
 * File type categories for easier validation
 */
export const FileTypeCategories = {
  IMAGES: [
    FileType.IMAGE_JPEG,
    FileType.IMAGE_PNG,
    FileType.IMAGE_GIF,
    FileType.IMAGE_WEBP,
    FileType.IMAGE_SVG,
  ],
  DOCUMENTS: [
    FileType.PDF,
    FileType.DOC,
    FileType.DOCX,
    FileType.XLS,
    FileType.XLSX,
    FileType.PPT,
    FileType.PPTX,
    FileType.TXT,
    FileType.CSV,
  ],
  ARCHIVES: [FileType.ZIP, FileType.RAR, FileType.TAR, FileType.GZIP],
  MEDIA: [FileType.MP4, FileType.MP3, FileType.WAV, FileType.AVI, FileType.MOV],
} as const;
