export interface IApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  data: T;
  timestamp: string;
  path: string;
  correlationId?: string;
}

export interface IErrorResponse {
  success: false;
  statusCode: number;
  timestamp: string;
  path: string;
  method: string;
  message: string;
  error?: string;
  correlationId?: string;
  validationErrors?: {
    field: string;
    message: string;
  }[];
}
