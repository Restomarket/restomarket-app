import { Test, type TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UserRepository } from '@database/adapters';
import { BusinessException, NotFoundException, ConflictException } from '@common/exceptions';
import { type CreateUserDto } from './dto/create-user.dto';
import { type UpdateUserDto } from './dto/update-user.dto';
import { type UpdateUserEmailDto } from './dto/update-user-email.dto';
import { type UpdateUserProfileDto } from './dto/update-user-profile.dto';
import { type User } from '@repo/shared';
import type { SortOrder } from '@common/dto/sort-query.dto';

describe('UsersService', () => {
  let service: UsersService;
  let repository: UserRepository;

  const mockUser: User = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    name: 'John Doe',
    email: 'test@example.com',
    emailVerified: false,
    image: null,
    role: 'member',
    firstName: 'John',
    lastName: 'Doe',
    isActive: true,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletedAt: null,
    banned: false,
    banReason: null,
    banExpires: null,
  };

  const mockUserRepository = {
    create: jest.fn(),
    findById: jest.fn(),
    findByEmail: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    updateWithTimestamp: jest.fn(),
    softDelete: jest.fn(),
    transaction: jest.fn(),
    getStatistics: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    repository = module.get<UserRepository>(UserRepository);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const createUserDto: CreateUserDto = {
      email: 'newuser@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
    };

    it('should create a new user successfully', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(mockUser);

      const result = await service.create(createUserDto);

      expect(repository.findByEmail).toHaveBeenCalledWith(createUserDto.email);
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: createUserDto.email,
          firstName: createUserDto.firstName,
          lastName: createUserDto.lastName,
          id: expect.any(String),
          name: 'Jane Smith',
        }),
      );
      expect(result).toEqual(mockUser);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockUserRepository.findByEmail.mockResolvedValue(mockUser);

      await expect(service.create(createUserDto)).rejects.toThrow(ConflictException);
      expect(repository.findByEmail).toHaveBeenCalledWith(createUserDto.email);
      expect(repository.create).not.toHaveBeenCalled();
    });
  });

  describe('findAllPaginated', () => {
    it('should return paginated users', async () => {
      const paginatedResult = {
        data: [mockUser],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      mockUserRepository.findMany.mockResolvedValue(paginatedResult);

      const result = await service.findAllPaginated(1, 10);

      expect(repository.findMany).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: undefined,
        sortBy: undefined,
        sortOrder: undefined,
      });
      expect(result).toEqual(paginatedResult);
    });

    it('should handle search and sorting parameters', async () => {
      const paginatedResult = {
        data: [mockUser],
        meta: {
          page: 1,
          limit: 10,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      mockUserRepository.findMany.mockResolvedValue(paginatedResult);

      await service.findAllPaginated(1, 10, 'john', 'email', 'asc' as SortOrder);

      expect(repository.findMany).toHaveBeenCalledWith({
        page: 1,
        limit: 10,
        search: 'john',
        sortBy: 'email',
        sortOrder: 'asc',
      });
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await service.findOne(mockUser.id);

      expect(repository.findById).toHaveBeenCalledWith(mockUser.id);
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
      expect(repository.findById).toHaveBeenCalledWith('non-existent-id');
    });
  });

  describe('update', () => {
    const updateUserDto: UpdateUserDto = {
      firstName: 'Jane',
      lastName: 'Updated',
    };

    it('should update a user successfully', async () => {
      const updatedUser = { ...mockUser, ...updateUserDto };
      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await service.update(mockUser.id, updateUserDto);

      expect(repository.findById).toHaveBeenCalledWith(mockUser.id);
      expect(repository.update).toHaveBeenCalledWith(mockUser.id, updateUserDto);
      expect(result).toEqual(updatedUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.update('non-existent-id', updateUserDto)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should check email uniqueness when updating email', async () => {
      const updateWithEmail: UpdateUserDto = {
        email: 'newemail@example.com',
      };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.updateWithTimestamp.mockResolvedValue({
        ...mockUser,
        ...updateWithEmail,
      });

      await service.update(mockUser.id, updateWithEmail);

      expect(repository.findByEmail).toHaveBeenCalledWith(updateWithEmail.email);
    });

    it('should throw ConflictException if new email already exists', async () => {
      const updateWithEmail: UpdateUserDto = {
        email: 'existing@example.com',
      };

      const anotherUser = { ...mockUser, id: 'different-id', email: 'existing@example.com' };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.findByEmail.mockResolvedValue(anotherUser);

      await expect(service.update(mockUser.id, updateWithEmail)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('should soft delete a user successfully', async () => {
      mockUserRepository.softDelete.mockResolvedValue(true);

      await service.remove(mockUser.id);

      expect(repository.softDelete).toHaveBeenCalledWith(mockUser.id);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.softDelete.mockResolvedValue(false);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('activateUser', () => {
    it('should activate an inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      const activatedUser = { ...mockUser, isActive: true };

      mockUserRepository.findById.mockResolvedValue(inactiveUser);
      mockUserRepository.update.mockResolvedValue(activatedUser);

      const result = await service.activateUser(mockUser.id);

      expect(repository.update).toHaveBeenCalledWith(mockUser.id, { isActive: true });
      expect(result).toEqual(activatedUser);
    });

    it('should return user if already active', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await service.activateUser(mockUser.id);

      expect(repository.update).not.toHaveBeenCalled();
      expect(result).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findById.mockResolvedValue(null);

      await expect(service.activateUser('non-existent-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BusinessException if user is deleted', async () => {
      const deletedUser = { ...mockUser, deletedAt: new Date() };
      mockUserRepository.findById.mockResolvedValue(deletedUser);

      await expect(service.activateUser(mockUser.id)).rejects.toThrow(BusinessException);
    });
  });

  describe('deactivateUser', () => {
    it('should deactivate an active user', async () => {
      const deactivatedUser = { ...mockUser, isActive: false };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue(deactivatedUser);

      const result = await service.deactivateUser(mockUser.id);

      expect(repository.update).toHaveBeenCalledWith(mockUser.id, { isActive: false });
      expect(result).toEqual(deactivatedUser);
    });

    it('should return user if already inactive', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockUserRepository.findById.mockResolvedValue(inactiveUser);

      const result = await service.deactivateUser(mockUser.id);

      expect(repository.update).not.toHaveBeenCalled();
      expect(result).toEqual(inactiveUser);
    });
  });

  describe('updateUserEmail', () => {
    const updateEmailDto: UpdateUserEmailDto = {
      email: 'newemail@example.com',
    };

    it('should update email successfully', async () => {
      const updatedUser = { ...mockUser, email: updateEmailDto.email };

      mockUserRepository.transaction.mockImplementation(async callback => {
        return callback({
          query: {
            authUsers: {
              findFirst: jest.fn().mockResolvedValueOnce(mockUser).mockResolvedValueOnce(null),
            },
          },
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([updatedUser]),
              }),
            }),
          }),
        });
      });

      const result = await service.updateUserEmail(mockUser.id, updateEmailDto);

      expect(result).toEqual(updatedUser);
    });

    it('should return user if email is unchanged', async () => {
      const sameEmailDto: UpdateUserEmailDto = {
        email: mockUser.email,
      };

      mockUserRepository.transaction.mockImplementation(async callback => {
        return callback({
          query: {
            authUsers: {
              findFirst: jest.fn().mockResolvedValue(mockUser),
            },
          },
        });
      });

      const result = await service.updateUserEmail(mockUser.id, sameEmailDto);

      expect(result).toEqual(mockUser);
    });
  });

  describe('updateUserProfile', () => {
    const updateProfileDto: UpdateUserProfileDto = {
      firstName: 'Jane',
      lastName: 'Smith',
    };

    it('should update user profile successfully', async () => {
      const updatedUser = { ...mockUser, ...updateProfileDto };

      mockUserRepository.findById.mockResolvedValue(mockUser);
      mockUserRepository.update.mockResolvedValue(updatedUser);

      const result = await service.updateUserProfile(mockUser.id, updateProfileDto);

      expect(repository.update).toHaveBeenCalledWith(mockUser.id, updateProfileDto);
      expect(result).toEqual(updatedUser);
    });
  });

  describe('Helper methods', () => {
    it('getUserFullName should return full name', () => {
      const fullName = service.getUserFullName(mockUser);
      expect(fullName).toBe('John Doe');
    });

    it('getEmailDomain should return email domain', () => {
      const domain = service.getEmailDomain(mockUser);
      expect(domain).toBe('example.com');
    });

    it('isProfileComplete should return true for complete profile', () => {
      const isComplete = service.isProfileComplete(mockUser);
      expect(isComplete).toBe(true);
    });

    it('isProfileComplete should return false for incomplete profile', () => {
      const incompleteUser = { ...mockUser, firstName: '' };
      const isComplete = service.isProfileComplete(incompleteUser);
      expect(isComplete).toBe(false);
    });
  });

  describe('canUserPerformAdminActions', () => {
    it('should return true for active non-deleted user', async () => {
      mockUserRepository.findById.mockResolvedValue(mockUser);

      const result = await service.canUserPerformAdminActions(mockUser.id);

      expect(result).toBe(true);
    });

    it('should return false for inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      mockUserRepository.findById.mockResolvedValue(inactiveUser);

      const result = await service.canUserPerformAdminActions(mockUser.id);

      expect(result).toBe(false);
    });

    it('should return false for deleted user', async () => {
      const deletedUser = { ...mockUser, deletedAt: new Date() };
      mockUserRepository.findById.mockResolvedValue(deletedUser);

      const result = await service.canUserPerformAdminActions(mockUser.id);

      expect(result).toBe(false);
    });
  });

  describe('findActiveUsers', () => {
    it('should return paginated active users', async () => {
      const paginatedResult = {
        data: [mockUser],
        meta: {
          page: 1,
          limit: 100,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      mockUserRepository.findMany.mockResolvedValue(paginatedResult);

      const result = await service.findActiveUsers();

      expect(repository.findMany).toHaveBeenCalledWith({
        isActive: true,
        limit: 100,
        page: 1,
      });
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('findUsersByEmailDomain', () => {
    it('should return users by email domain', async () => {
      const paginatedResult = {
        data: [mockUser],
        meta: {
          page: 1,
          limit: 100,
          total: 1,
          totalPages: 1,
          hasNextPage: false,
          hasPreviousPage: false,
        },
      };

      mockUserRepository.findMany.mockResolvedValue(paginatedResult);

      const result = await service.findUsersByEmailDomain('example.com');

      expect(repository.findMany).toHaveBeenCalledWith({
        emailDomain: 'example.com',
        limit: 100,
        page: 1,
      });
      expect(result).toEqual(paginatedResult);
    });
  });

  describe('getStatistics', () => {
    it('should return user statistics', async () => {
      const stats = {
        total: 100,
        active: 80,
        inactive: 15,
        deleted: 5,
      };

      mockUserRepository.getStatistics.mockResolvedValue(stats);

      const result = await service.getStatistics();

      expect(repository.getStatistics).toHaveBeenCalled();
      expect(result).toEqual(stats);
    });
  });
});
