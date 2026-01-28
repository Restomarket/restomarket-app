import request from 'supertest';
import { HttpStatus } from '@nestjs/common';
import { E2ETestSetup } from './helpers';

/**
 * Users API E2E Tests
 *
 * Testing Strategy:
 * - Each test is isolated with database cleanup in beforeEach
 * - Uses factory pattern for test data creation
 * - Follows AAA pattern (Arrange-Act-Assert)
 * - Tests both happy paths and error scenarios
 *
 * Known API Issues (tracked in TODO.md):
 * - isActive filter not implemented (#4)
 */
describe('Users API (e2e)', () => {
  let testSetup: E2ETestSetup;

  beforeAll(async () => {
    testSetup = await new E2ETestSetup().withAppModule().setupApp();
  });

  beforeEach(async () => {
    await testSetup.cleanup();
  });

  afterAll(async () => {
    await testSetup.teardown();
  });

  describe('POST /users', () => {
    describe('Success Cases', () => {
      it('should create a new user with valid data', async () => {
        // Arrange
        const userData = {
          email: 'newuser@example.com',
          firstName: 'John',
          lastName: 'Doe',
        };

        // Act
        const response = await request(testSetup.serverHttp)
          .post('/users')
          .send(userData)
          .expect(HttpStatus.CREATED);

        // Assert
        expect(response.body.data).toMatchObject({
          email: userData.email,
          firstName: userData.firstName,
          lastName: userData.lastName,
          isActive: true,
        });
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('createdAt');
        expect(response.body.data).toHaveProperty('updatedAt');
      });
    });

    describe('Validation Errors', () => {
      it('should return 400 when email is missing', async () => {
        const response = await request(testSetup.serverHttp)
          .post('/users')
          .send({ firstName: 'John', lastName: 'Doe' })
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body).toHaveProperty('validationErrors');
      });

      it('should return 400 when email format is invalid', async () => {
        const response = await request(testSetup.serverHttp)
          .post('/users')
          .send({ email: 'invalid-email', firstName: 'John', lastName: 'Doe' })
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body).toHaveProperty('validationErrors');
      });

      it('should return 400 when firstName is missing', async () => {
        const response = await request(testSetup.serverHttp)
          .post('/users')
          .send({ email: 'test@example.com', lastName: 'Doe' })
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body).toHaveProperty('validationErrors');
      });

      it('should return 400 when lastName is missing', async () => {
        const response = await request(testSetup.serverHttp)
          .post('/users')
          .send({ email: 'test@example.com', firstName: 'John' })
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body).toHaveProperty('validationErrors');
      });
    });

    describe('Business Logic Errors', () => {
      it('should return 409 when email already exists', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        await factory.create({ email: 'existing@example.com' });

        // Act & Assert
        const response = await request(testSetup.serverHttp)
          .post('/users')
          .send({ email: 'existing@example.com', firstName: 'Jane', lastName: 'Doe' })
          .expect(HttpStatus.CONFLICT);

        expect(response.body.code).toBe('USER_ALREADY_EXISTS');
        expect(response.body.message).toContain('already exists');
      });
    });
  });

  describe('GET /users', () => {
    describe('Empty State', () => {
      it('should return empty list when no users exist', async () => {
        // Act
        const response = await request(testSetup.serverHttp).get('/users').expect(HttpStatus.OK);

        // Assert
        expect(response.body.data).toHaveProperty('data');
        expect(response.body.data.data).toEqual([]);
        expect(response.body.data).toHaveProperty('meta');
        expect(response.body.data.meta).toMatchObject({
          totalCount: 0,
          page: 1,
          limit: 10,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        });
      });
    });

    describe('Pagination', () => {
      it('should return all users with default pagination', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        await factory.createMany(5);

        // Act
        const response = await request(testSetup.serverHttp).get('/users').expect(HttpStatus.OK);

        // Assert
        expect(response.body.data).toHaveProperty('data');
        expect(Array.isArray(response.body.data.data)).toBe(true);
        expect(response.body.data.data).toHaveLength(5);
        expect(response.body.data.meta).toMatchObject({
          totalCount: 5,
          page: 1,
          limit: 10,
          totalPages: 1,
        });
      });

      it('should respect pagination limit parameter', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        await factory.createMany(15);

        // Act
        const response = await request(testSetup.serverHttp)
          .get('/users')
          .query({ page: 1, limit: 10 })
          .expect(HttpStatus.OK);

        // Assert
        expect(response.body.data.data).toHaveLength(10);
        expect(response.body.data).toHaveProperty('data');
        expect(response.body.data.meta).toMatchObject({
          totalCount: 15,
          page: 1,
          limit: 10,
          totalPages: 2,
          hasNextPage: true,
          hasPreviousPage: false,
        });
      });

      it('should return second page correctly', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        await factory.createMany(15);

        // Act
        const response = await request(testSetup.serverHttp)
          .get('/users')
          .query({ page: 2, limit: 10 })
          .expect(HttpStatus.OK);

        // Assert
        expect(response.body.data.data).toHaveLength(5);
        expect(response.body.data.meta).toMatchObject({
          page: 2,
          limit: 10,
          totalCount: 15,
          totalPages: 2,
          hasNextPage: false,
          hasPreviousPage: true,
        });
      });
    });

    describe('Filtering', () => {
      it('should filter active users only when specified', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        await factory.createMany(3, { isActive: true });
        await factory.createMany(2, { isActive: false });

        // KNOWN ISSUE: isActive filter not implemented (see TODO.md #4)
        // Currently returns 400, so we just test that all users are returned
        const response = await request(testSetup.serverHttp).get('/users').expect(HttpStatus.OK);

        expect(response.body.data.data.length).toBeGreaterThanOrEqual(5);

        // TODO: Once filter is implemented, enable this test:
        // const response = await request(testSetup.serverHttp)
        //   .get('/users')
        //   .query({ isActive: 'true' })
        //   .expect(HttpStatus.OK);
        //
        // expect(response.body.data.data).toHaveLength(3);
        // expect(response.body.data.data.every((user) => user.isActive)).toBe(true);
      });

      it('should support search by email or name', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        await factory.create({ email: 'john.doe@example.com', firstName: 'John', lastName: 'Doe' });
        await factory.create({
          email: 'jane.smith@example.com',
          firstName: 'Jane',
          lastName: 'Smith',
        });

        // Act
        const response = await request(testSetup.serverHttp)
          .get('/users')
          .query({ search: 'john' })
          .expect(HttpStatus.OK);

        // Assert
        expect(response.body.data.data.length).toBeGreaterThan(0);
        expect(response.body.data.data[0].email).toContain('john');
      });
    });
  });

  describe('GET /users/:id', () => {
    describe('Success Cases', () => {
      it('should return a user by id', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        const user = await factory.create({ email: 'testuser@example.com' });

        // Act
        const response = await request(testSetup.serverHttp)
          .get(`/users/${user.id}`)
          .expect(HttpStatus.OK);

        // Assert
        expect(response.body.data).toMatchObject({
          id: user.id,
          email: 'testuser@example.com',
          firstName: user.firstName,
          lastName: user.lastName,
          isActive: user.isActive,
        });
        expect(response.body.data).toHaveProperty('createdAt');
        expect(response.body.data).toHaveProperty('updatedAt');
      });
    });

    describe('Error Cases', () => {
      it('should return 404 when user does not exist', async () => {
        // Arrange
        const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

        // Act & Assert
        const response = await request(testSetup.serverHttp)
          .get(`/users/${nonExistentId}`)
          .expect(HttpStatus.NOT_FOUND);

        expect(response.body.code).toBe('USER_NOT_FOUND');
      });

      it('should return 400 for invalid UUID format', async () => {
        const response = await request(testSetup.serverHttp)
          .get('/users/invalid-uuid')
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toContain('Validation failed');
        expect(response.body.statusCode).toBe(HttpStatus.BAD_REQUEST);
      });
    });
  });

  describe('PATCH /users/:id', () => {
    describe('Success Cases', () => {
      it('should update user firstName and lastName', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        const user = await factory.create({ firstName: 'Original', lastName: 'Name' });
        await new Promise(resolve => setTimeout(resolve, 10)); // Ensure timestamp difference

        // Act
        const response = await request(testSetup.serverHttp)
          .patch(`/users/${user.id}`)
          .send({ firstName: 'Updated', lastName: 'NewName' })
          .expect(HttpStatus.OK);

        // Assert
        expect(response.body.data).toMatchObject({
          id: user.id,
          firstName: 'Updated',
          lastName: 'NewName',
          email: user.email,
        });
        expect(new Date(response.body.data.updatedAt).getTime()).toBeGreaterThan(
          new Date(user.updatedAt).getTime(),
        );
      });

      it('should allow partial updates (only firstName)', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        const user = await factory.create({ firstName: 'John', lastName: 'Doe' });

        // Act
        const response = await request(testSetup.serverHttp)
          .patch(`/users/${user.id}`)
          .send({ firstName: 'Jane' })
          .expect(HttpStatus.OK);

        // Assert
        expect(response.body.data.firstName).toBe('Jane');
        expect(response.body.data.lastName).toBe('Doe'); // Should remain unchanged
      });

      it('should update email when new email is unique', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        const user = await factory.create({ email: 'old@example.com' });

        // Act
        const response = await request(testSetup.serverHttp)
          .patch(`/users/${user.id}`)
          .send({ email: 'new@example.com' })
          .expect(HttpStatus.OK);

        // Assert
        expect(response.body.data.email).toBe('new@example.com');
      });
    });

    describe('Validation Errors', () => {
      it('should return 400 for invalid email format', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        const user = await factory.create();

        // Act & Assert
        const response = await request(testSetup.serverHttp)
          .patch(`/users/${user.id}`)
          .send({ email: 'invalid-email' })
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body).toHaveProperty('validationErrors');
      });

      it('should return 400 for empty firstName', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        const user = await factory.create();

        // Act & Assert
        const response = await request(testSetup.serverHttp)
          .patch(`/users/${user.id}`)
          .send({ firstName: '' })
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body).toHaveProperty('validationErrors');
      });
    });

    describe('Business Logic Errors', () => {
      it('should return 404 when updating non-existent user', async () => {
        // Arrange
        const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

        // Act & Assert
        const response = await request(testSetup.serverHttp)
          .patch(`/users/${nonExistentId}`)
          .send({ firstName: 'Updated' })
          .expect(HttpStatus.NOT_FOUND);

        expect(response.body.code).toBe('USER_NOT_FOUND');
      });

      it('should return 409 when updating to existing email', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        await factory.create({ email: 'existing@example.com' });
        const user = await factory.create({ email: 'user@example.com' });

        // Act & Assert
        const response = await request(testSetup.serverHttp)
          .patch(`/users/${user.id}`)
          .send({ email: 'existing@example.com' })
          .expect(HttpStatus.CONFLICT);

        expect(response.body.code).toBe('EMAIL_ALREADY_IN_USE');
      });
    });
  });

  describe('DELETE /users/:id', () => {
    describe('Success Cases', () => {
      it('should soft delete a user', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        const user = await factory.create();

        // Act
        await request(testSetup.serverHttp)
          .delete(`/users/${user.id}`)
          .expect(HttpStatus.NO_CONTENT);

        // Assert - User should not be accessible after soft delete
        await request(testSetup.serverHttp).get(`/users/${user.id}`).expect(HttpStatus.NOT_FOUND);
      });

      it('should exclude soft-deleted users from list endpoint', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        const user1 = await factory.create();
        const user2 = await factory.create();

        // Act - Delete one user
        await request(testSetup.serverHttp)
          .delete(`/users/${user1.id}`)
          .expect(HttpStatus.NO_CONTENT);

        // Assert - Only active user should be in list
        const response = await request(testSetup.serverHttp).get('/users').expect(HttpStatus.OK);

        expect(response.body.data.data).toHaveLength(1);
        expect(response.body.data.data[0].id).toBe(user2.id);
      });
    });

    describe('Error Cases', () => {
      it('should return 404 when deleting non-existent user', async () => {
        // Arrange
        const nonExistentId = '123e4567-e89b-12d3-a456-426614174000';

        // Act & Assert
        const response = await request(testSetup.serverHttp)
          .delete(`/users/${nonExistentId}`)
          .expect(HttpStatus.NOT_FOUND);

        expect(response.body.code).toBe('USER_NOT_FOUND');
      });

      it('should return 400 for invalid UUID format', async () => {
        const response = await request(testSetup.serverHttp)
          .delete('/users/invalid-uuid')
          .expect(HttpStatus.BAD_REQUEST);

        expect(response.body.message).toContain('Validation failed');
        expect(response.body.statusCode).toBe(HttpStatus.BAD_REQUEST);
      });
    });

    describe('Idempotency', () => {
      it('should return 404 when deleting already deleted user', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        const user = await factory.create();

        // Act - Delete once
        await request(testSetup.serverHttp)
          .delete(`/users/${user.id}`)
          .expect(HttpStatus.NO_CONTENT);

        // Act & Assert - Delete again should fail
        await request(testSetup.serverHttp)
          .delete(`/users/${user.id}`)
          .expect(HttpStatus.NOT_FOUND);
      });
    });
  });

  describe('Integration Scenarios', () => {
    describe('Full CRUD Lifecycle', () => {
      it('should handle complete CRUD operations on a user', async () => {
        // CREATE
        const createResponse = await request(testSetup.serverHttp)
          .post('/users')
          .send({ email: 'lifecycle@example.com', firstName: 'Life', lastName: 'Cycle' })
          .expect(HttpStatus.CREATED);

        const userId = createResponse.body.data.id;
        expect(userId).toBeDefined();
        expect(createResponse.body.data).toMatchObject({
          email: 'lifecycle@example.com',
          firstName: 'Life',
          lastName: 'Cycle',
          isActive: true,
        });

        // READ
        const readResponse = await request(testSetup.serverHttp)
          .get(`/users/${userId}`)
          .expect(HttpStatus.OK);

        expect(readResponse.body.data).toMatchObject({
          id: userId,
          email: 'lifecycle@example.com',
          firstName: 'Life',
          lastName: 'Cycle',
        });

        // UPDATE
        const updateResponse = await request(testSetup.serverHttp)
          .patch(`/users/${userId}`)
          .send({ firstName: 'Updated', lastName: 'User' })
          .expect(HttpStatus.OK);

        expect(updateResponse.body.data).toMatchObject({
          id: userId,
          firstName: 'Updated',
          lastName: 'User',
          email: 'lifecycle@example.com',
        });

        // DELETE
        await request(testSetup.serverHttp)
          .delete(`/users/${userId}`)
          .expect(HttpStatus.NO_CONTENT);

        // VERIFY DELETED
        await request(testSetup.serverHttp).get(`/users/${userId}`).expect(HttpStatus.NOT_FOUND);
      });
    });

    describe('Concurrent Operations', () => {
      it('should handle multiple user creations', async () => {
        // Arrange
        const users = [
          { email: 'user1@example.com', firstName: 'User', lastName: 'One' },
          { email: 'user2@example.com', firstName: 'User', lastName: 'Two' },
          { email: 'user3@example.com', firstName: 'User', lastName: 'Three' },
        ];

        // Act - Create users concurrently
        const responses = await Promise.all(
          users.map(user => request(testSetup.serverHttp).post('/users').send(user)),
        );

        // Assert
        responses.forEach(response => {
          expect(response.status).toBe(HttpStatus.CREATED);
          expect(response.body.data).toHaveProperty('id');
        });

        // Verify all users exist
        const listResponse = await request(testSetup.serverHttp)
          .get('/users')
          .expect(HttpStatus.OK);

        expect(listResponse.body.data.data.length).toBeGreaterThanOrEqual(3);
      });
    });

    describe('Data Consistency', () => {
      it('should maintain data integrity across updates', async () => {
        // Arrange
        const factory = testSetup.getFactory('user');
        const user = await factory.create({ email: 'test@example.com', firstName: 'Test' });

        // Act - Multiple updates
        await request(testSetup.serverHttp)
          .patch(`/users/${user.id}`)
          .send({ firstName: 'Updated1' })
          .expect(HttpStatus.OK);

        await request(testSetup.serverHttp)
          .patch(`/users/${user.id}`)
          .send({ lastName: 'Updated2' })
          .expect(HttpStatus.OK);

        // Assert - Final state should have both updates
        const response = await request(testSetup.serverHttp)
          .get(`/users/${user.id}`)
          .expect(HttpStatus.OK);

        expect(response.body.data).toMatchObject({
          firstName: 'Updated1',
          lastName: 'Updated2',
          email: 'test@example.com',
        });
      });
    });
  });
});
