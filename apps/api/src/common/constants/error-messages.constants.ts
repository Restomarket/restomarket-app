/**
 * Standardized error messages
 */
export const ERROR_MESSAGES = {
  // General errors
  INTERNAL_SERVER_ERROR: 'An unexpected error occurred. Please try again later.',
  BAD_REQUEST: 'Invalid request data.',
  UNAUTHORIZED: 'You are not authorized to access this resource.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'The requested resource was not found.',
  CONFLICT: 'A conflict occurred while processing your request.',
  TIMEOUT: 'Request timeout exceeded.',

  // Validation errors
  VALIDATION_FAILED: 'Validation failed.',
  INVALID_EMAIL: 'Invalid email address.',
  INVALID_UUID: 'Invalid UUID format.',
  REQUIRED_FIELD: 'This field is required.',

  // Resource-specific errors
  resourceNotFound: (resource: string, id: string) => `${resource} with ID ${id} not found.`,
  resourceAlreadyExists: (resource: string) => `${resource} already exists.`,
  resourceDeleted: (resource: string) => `${resource} was successfully deleted.`,

  // Authentication errors
  INVALID_CREDENTIALS: 'Invalid email or password.',
  TOKEN_EXPIRED: 'Your session has expired. Please login again.',
  TOKEN_INVALID: 'Invalid authentication token.',

  // User-specific errors
  USER_NOT_FOUND: 'User not found.',
  USER_ALREADY_EXISTS: 'A user with this email already exists.',
  USER_INACTIVE: 'This user account is inactive.',

  // Database errors
  DATABASE_ERROR: 'A database error occurred.',
  DATABASE_CONNECTION_ERROR: 'Could not connect to the database.',
} as const;

/**
 * Success messages
 */
export const SUCCESS_MESSAGES = {
  CREATED: 'Resource created successfully.',
  UPDATED: 'Resource updated successfully.',
  DELETED: 'Resource deleted successfully.',
  OPERATION_SUCCESS: 'Operation completed successfully.',
} as const;
