import { Request, Response } from 'express';
import prisma from '../config/database';
import { hashPassword, comparePassword } from '../utils/hash';
import { generateToken } from '../utils/jwt';
import { sendSuccess, sendError } from '../utils/response';
import { UserRole } from '@prisma/client';

/**
 * Register a new user (PUBLIC - OWNER only)
 * This is for new business owners to create their account
 */
export const register = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password, firstName, lastName, phone } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return sendError(res, 'Please provide all required fields', 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendError(res, 'Invalid email format', 400);
    }

    // Validate password strength (min 8 characters, uppercase, lowercase, number)
    if (password.length < 8) {
      return sendError(res, 'Password must be at least 8 characters long', 400);
    }
    if (!/[A-Z]/.test(password)) {
      return sendError(res, 'Password must contain at least one uppercase letter', 400);
    }
    if (!/[a-z]/.test(password)) {
      return sendError(res, 'Password must contain at least one lowercase letter', 400);
    }
    if (!/[0-9]/.test(password)) {
      return sendError(res, 'Password must contain at least one number', 400);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return sendError(res, 'User with this email already exists', 409);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user as OWNER (public registration is ONLY for business owners)
    // CRITICAL: For OWNER role, ownerId is NULL (they ARE the owner/tenant root)
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role: UserRole.OWNER, // Always OWNER for public registration
        phone,
        ownerId: null, // NULL for owners - they are the tenant root
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        ownerId: true,
        storeId: true,
        createdAt: true,
      },
    });

    // Generate JWT token with ownerId
    // For OWNER: ownerId === userId (they are their own tenant)
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      ownerId: user.id, // Owner IS the tenant
    });

    return sendSuccess(
      res,
      {
        user,
        token,
      },
      'Account created successfully. Welcome!',
      201
    );
  } catch (error: any) {
    console.error('Register error:', error);
    return sendError(res, error.message || 'Failed to register user', 500);
  }
};

/**
 * Login user
 */
export const login = async (req: Request, res: Response): Promise<Response> => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return sendError(res, 'Please provide email and password', 400);
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        store: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
    });

    if (!user) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      return sendError(res, 'Your account has been deactivated', 403);
    }

    // Compare password
    const isPasswordValid = await comparePassword(password, user.password);

    if (!isPasswordValid) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // Determine ownerId for JWT token
    // If user is OWNER: ownerId = userId (they are the tenant)
    // If user is MANAGER/CASHIER: ownerId = their ownerId field
    const ownerId = user.role === UserRole.OWNER ? user.id : (user.ownerId || user.id);

    // Generate JWT token with ownerId for tenant context
    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role,
      ownerId: ownerId,
    });

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    return sendSuccess(
      res,
      {
        user: userWithoutPassword,
        token,
      },
      'Login successful'
    );
  } catch (error: any) {
    console.error('Login error:', error);
    return sendError(res, error.message || 'Failed to login', 500);
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        storeId: true,
        store: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    return sendSuccess(res, user, 'Profile retrieved successfully');
  } catch (error: any) {
    console.error('Get profile error:', error);
    return sendError(res, error.message || 'Failed to get profile', 500);
  }
};

/**
 * Update user profile
 */
export const updateProfile = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    const { firstName, lastName, phone } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone && { phone }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        storeId: true,
        updatedAt: true,
      },
    });

    return sendSuccess(res, updatedUser, 'Profile updated successfully');
  } catch (error: any) {
    console.error('Update profile error:', error);
    return sendError(res, error.message || 'Failed to update profile', 500);
  }
};

/**
 * Change password
 */
export const changePassword = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    const { currentPassword, newPassword } = req.body;

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return sendError(res, 'Please provide current and new password', 400);
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return sendError(res, 'New password must be at least 8 characters long', 400);
    }
    if (!/[A-Z]/.test(newPassword)) {
      return sendError(res, 'Password must contain at least one uppercase letter', 400);
    }
    if (!/[a-z]/.test(newPassword)) {
      return sendError(res, 'Password must contain at least one lowercase letter', 400);
    }
    if (!/[0-9]/.test(newPassword)) {
      return sendError(res, 'Password must contain at least one number', 400);
    }

    // Get user with password
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
    });

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Verify current password
    const isPasswordValid = await comparePassword(currentPassword, user.password);

    if (!isPasswordValid) {
      return sendError(res, 'Current password is incorrect', 401);
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { password: hashedPassword },
    });

    return sendSuccess(res, null, 'Password changed successfully');
  } catch (error: any) {
    console.error('Change password error:', error);
    return sendError(res, error.message || 'Failed to change password', 500);
  }
};

/**
 * Create employee (OWNER/MANAGER only) (TENANT-SCOPED)
 * Employee will be created under the authenticated user's owner
 */
export const createEmployee = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const { email, password, firstName, lastName, role, phone, storeId } = req.body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName || !role || !storeId) {
      return sendError(res, 'Please provide all required fields', 400);
    }

    // Only OWNER and MANAGER can create employees
    if (req.user.role !== UserRole.OWNER && req.user.role !== UserRole.MANAGER) {
      return sendError(res, 'Only owners and managers can create employees', 403);
    }

    // MANAGER can only create CASHIER
    if (req.user.role === UserRole.MANAGER && role !== UserRole.CASHIER) {
      return sendError(res, 'Managers can only create cashier accounts', 403);
    }

    // OWNER cannot create another OWNER
    if (role === UserRole.OWNER) {
      return sendError(res, 'Cannot create another owner account', 403);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendError(res, 'Invalid email format', 400);
    }

    // Validate password strength
    if (password.length < 8) {
      return sendError(res, 'Password must be at least 8 characters long', 400);
    }
    if (!/[A-Z]/.test(password)) {
      return sendError(res, 'Password must contain at least one uppercase letter', 400);
    }
    if (!/[a-z]/.test(password)) {
      return sendError(res, 'Password must contain at least one lowercase letter', 400);
    }
    if (!/[0-9]/.test(password)) {
      return sendError(res, 'Password must contain at least one number', 400);
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return sendError(res, 'User with this email already exists', 409);
    }

    // Verify store exists AND belongs to this owner (TENANT VALIDATION)
    const store = await prisma.store.findFirst({
      where: {
        id: storeId,
        ownerId: req.ownerId, // TENANT FILTER
      },
    });

    if (!store) {
      return sendError(res, 'Store not found', 404);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create employee
    const employee = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        role,
        phone,
        storeId,
        ownerId: req.ownerId, // CRITICAL: Assign employee to the authenticated owner
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        storeId: true,
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
      },
    });

    return sendSuccess(res, employee, 'Employee created successfully', 201);
  } catch (error: any) {
    console.error('Create employee error:', error);
    return sendError(res, error.message || 'Failed to create employee', 500);
  }
};

/**
 * Get all employees (OWNER/MANAGER only) (TENANT-FILTERED)
 * Only returns employees belonging to the authenticated user's owner
 */
export const getAllEmployees = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    // Only OWNER and MANAGER can view employees
    if (req.user.role !== UserRole.OWNER && req.user.role !== UserRole.MANAGER) {
      return sendError(res, 'Only owners and managers can view employees', 403);
    }

    const where: any = {
      ownerId: req.ownerId, // TENANT FILTER - CRITICAL!
      role: { not: UserRole.OWNER }, // Don't include owners in employee list
    };

    // MANAGER can only see employees in their store
    if (req.user.role === UserRole.MANAGER) {
      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { storeId: true },
      });

      if (!currentUser?.storeId) {
        return sendError(res, 'Manager must be assigned to a store', 400);
      }

      where.storeId = currentUser.storeId;
      where.role = UserRole.CASHIER; // MANAGER can only see cashiers
    }

    const employees = await prisma.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        storeId: true,
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sendSuccess(res, employees, 'Employees retrieved successfully');
  } catch (error: any) {
    console.error('Get employees error:', error);
    return sendError(res, error.message || 'Failed to get employees', 500);
  }
};

/**
 * Update employee (OWNER/MANAGER only) (TENANT-VALIDATED)
 * Can only update employees belonging to the authenticated user's owner
 */
export const updateEmployee = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const { id } = req.params;
    const { firstName, lastName, phone, storeId, isActive } = req.body;

    // Only OWNER and MANAGER can update employees
    if (req.user.role !== UserRole.OWNER && req.user.role !== UserRole.MANAGER) {
      return sendError(res, 'Only owners and managers can update employees', 403);
    }

    // Get employee to update AND verify ownership (TENANT VALIDATION)
    const employee = await prisma.user.findFirst({
      where: {
        id,
        ownerId: req.ownerId, // CRITICAL: Ensure employee belongs to this owner
      },
    });

    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    // Cannot update owner accounts
    if (employee.role === UserRole.OWNER) {
      return sendError(res, 'Cannot update owner accounts', 403);
    }

    // MANAGER can only update cashiers in their store
    if (req.user.role === UserRole.MANAGER) {
      const currentUser = await prisma.user.findUnique({
        where: { id: req.user.userId },
        select: { storeId: true },
      });

      if (employee.storeId !== currentUser?.storeId || employee.role !== UserRole.CASHIER) {
        return sendError(res, 'Managers can only update cashiers in their store', 403);
      }
    }

    // Verify store if changing AND belongs to this owner (TENANT VALIDATION)
    if (storeId && storeId !== employee.storeId) {
      const store = await prisma.store.findFirst({
        where: {
          id: storeId,
          ownerId: req.ownerId, // TENANT FILTER
        },
      });

      if (!store) {
        return sendError(res, 'Store not found', 404);
      }
    }

    // Update employee
    const updatedEmployee = await prisma.user.update({
      where: { id },
      data: {
        ...(firstName && { firstName }),
        ...(lastName && { lastName }),
        ...(phone !== undefined && { phone }),
        ...(storeId && { storeId }),
        ...(isActive !== undefined && { isActive }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        isActive: true,
        storeId: true,
        store: {
          select: {
            id: true,
            name: true,
          },
        },
        updatedAt: true,
      },
    });

    return sendSuccess(res, updatedEmployee, 'Employee updated successfully');
  } catch (error: any) {
    console.error('Update employee error:', error);
    return sendError(res, error.message || 'Failed to update employee', 500);
  }
};

/**
 * Delete employee (OWNER only) (TENANT-VALIDATED)
 * Can only delete employees belonging to the authenticated user's owner
 */
export const deleteEmployee = async (req: Request, res: Response): Promise<Response> => {
  try {
    if (!req.user) {
      return sendError(res, 'Unauthorized', 401);
    }

    // CRITICAL: Ensure tenant context exists
    if (!req.ownerId) {
      return sendError(res, 'Unauthorized - no tenant context', 401);
    }

    const { id } = req.params;

    // Only OWNER can delete employees
    if (req.user.role !== UserRole.OWNER) {
      return sendError(res, 'Only owners can delete employees', 403);
    }

    // Get employee to delete AND verify ownership (TENANT VALIDATION)
    const employee = await prisma.user.findFirst({
      where: {
        id,
        ownerId: req.ownerId, // CRITICAL: Ensure employee belongs to this owner
      },
    });

    if (!employee) {
      return sendError(res, 'Employee not found', 404);
    }

    // Cannot delete owner accounts
    if (employee.role === UserRole.OWNER) {
      return sendError(res, 'Cannot delete owner accounts', 403);
    }

    // Delete employee
    await prisma.user.delete({
      where: { id },
    });

    return sendSuccess(res, null, 'Employee deleted successfully');
  } catch (error: any) {
    console.error('Delete employee error:', error);
    return sendError(res, error.message || 'Failed to delete employee', 500);
  }
};
