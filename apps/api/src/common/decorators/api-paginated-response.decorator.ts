import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export const ApiPaginatedResponse = <TModel extends Type>(model: TModel) => {
  return applyDecorators(
    ApiExtraModels(model),
    ApiOkResponse({
      description: 'Paginated response',
      schema: {
        allOf: [
          {
            properties: {
              success: {
                type: 'boolean',
                example: true,
              },
              statusCode: {
                type: 'number',
                example: 200,
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                example: '2024-01-01T00:00:00.000Z',
              },
              path: {
                type: 'string',
                example: '/api/v1/users',
              },
              correlationId: {
                type: 'string',
                example: '123e4567-e89b-12d3-a456-426614174000',
              },
              data: {
                type: 'object',
                properties: {
                  data: {
                    type: 'array',
                    items: { $ref: getSchemaPath(model) },
                  },
                  meta: {
                    type: 'object',
                    properties: {
                      page: {
                        type: 'number',
                        example: 1,
                      },
                      limit: {
                        type: 'number',
                        example: 10,
                      },
                      totalCount: {
                        type: 'number',
                        example: 100,
                      },
                      totalPages: {
                        type: 'number',
                        example: 10,
                      },
                      hasNextPage: {
                        type: 'boolean',
                        example: true,
                      },
                      hasPreviousPage: {
                        type: 'boolean',
                        example: false,
                      },
                    },
                  },
                },
              },
            },
          },
        ],
      },
    }),
  );
};
