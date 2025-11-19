import {
  Injectable,
  ForbiddenException,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '../auth/roles.enum';
import * as bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

type UserStatusType = 'active' | 'inactive';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  // =====================
  // HÀM ĐANG DÙNG CHO AUTH (GIỮ NGUYÊN)
  // =====================

  async findByUsername(username: string) {
    return this.prisma.user.findUnique({
      where: { username },
    });
  }

  async updateLastLogin(userId: string) {
    return this.prisma.user.update({
      where: { id: userId },
      data: { last_login_at: new Date() },
    });
  }

  /**
   * Low-level create user
   * - Dùng cho seed / nội bộ.
   * - KHÔNG kiểm tra quyền người gọi.
   * Sprint 2: controller sẽ dùng createUserWithRoleCheck().
   */
  async createUser(data: {
    full_name: string;
    username: string;
    password_hash: string;
    role: Role; // 'admin' | 'manager' | 'user'
    department: string | null;
  }) {
    try {
      return this.prisma.user.create({
        data: {
          full_name: data.full_name,
          username: data.username,
          password_hash: data.password_hash,
          role: data.role,
          department: data.department,
          status: 'active',
          created_at: new Date(),
        },
        select: {
          id: true,
          full_name: true,
          username: true,
          role: true,
          department: true,
          status: true,
        },
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002' &&
        Array.isArray(e.meta?.target) &&
        (e.meta!.target as string[]).includes('username')
      ) {
        // username trùng
        throw new BadRequestException(
          'Username đã tồn tại, vui lòng chọn tên khác',
        );
      }
      throw e;
    }
  }

  // =====================
  // HÀM PHỤC VỤ TRANG QUẢN TRỊ (SPRINT 2)
  // =====================

  /** Lấy danh sách user (sau này controller sẽ bảo vệ bằng RolesGuard) */
  async listUsers() {
    return this.prisma.user.findMany({
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        full_name: true,
        username: true,
        role: true,
        department: true,
        status: true,
        created_at: true,
        last_login_at: true,
      },
    });
  }

  /** Lấy chi tiết 1 user */
  async getUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        full_name: true,
        username: true,
        role: true,
        department: true,
        status: true,
        created_at: true,
        last_login_at: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User không tồn tại');
    }

    return user;
  }

  /**
   * Tạo user với kiểm tra quyền:
   * - user thường: không được tạo ai hết
   * - manager: chỉ được tạo user role = 'user'
   * - admin: được tạo mọi role (admin / manager / user)
   * - Riêng rule của anh: CHỈ admin mới được tạo user manager.
   */
  async createUserWithRoleCheck(params: {
    actorRole: Role; // role của người đang đăng nhập
    data: {
      full_name: string;
      username: string;
      password_hash: string;
      role: Role; // role của user sắp tạo
      department: string | null;
    };
  }) {
    const { actorRole, data } = params;

    // 1. user thường không được tạo ai hết
    if (actorRole === Role.user) {
      throw new ForbiddenException('Bạn không có quyền tạo tài khoản mới');
    }

    // 2. manager không được tạo admin/manager
    if (actorRole === Role.manager) {
      if (data.role === Role.admin || data.role === Role.manager) {
        throw new ForbiddenException(
          'Chỉ admin mới có quyền tạo tài khoản Admin / Manager',
        );
      }
    }

    // 3. admin: ok, nhưng phải bắt lỗi trùng username
    try {
      return await this.prisma.user.create({
        data: {
          full_name: data.full_name,
          username: data.username,
          password_hash: data.password_hash,
          role: data.role,
          department: data.department,
          status: 'active',
          created_at: new Date(),
        },
        select: {
          id: true,
          full_name: true,
          username: true,
          role: true,
          department: true,
          status: true,
        },
      });
    } catch (e: any) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        // P2002: unique constraint failed
        if (
          Array.isArray((e.meta as any)?.target) &&
          (e.meta as any).target.includes('username')
        ) {
          throw new ConflictException(
            'Username đã tồn tại, vui lòng chọn tên khác',
          );
        }
      }
      throw e; // các lỗi khác để Nest xử lý
    }
  }

  /**
   * Cập nhật thông tin user:
   * - Admin: được sửa mọi thứ (kể cả role & status)
   * - Manager:
   *   + Được sửa user role = 'user'
   *   + KHÔNG được sửa user có role = 'admin' | 'manager'
   * - User thường: không được gọi hàm này (controller nên chặn từ trước)
   */
  async updateUserWithRoleCheck(params: {
    actorRole: Role;
    targetUserId: string;
    data: {
      full_name?: string;
      username?: string;
      department?: string;
      status?: UserStatusType;
      role?: Role;
    };
  }) {
    const { actorRole, targetUserId, data } = params;

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true },
    });

    if (!target) {
      throw new NotFoundException('User không tồn tại');
    }

    if (actorRole === Role.user) {
      throw new ForbiddenException('Bạn không có quyền chỉnh sửa tài khoản');
    }

    // Manager không được sửa admin/manager
    if (actorRole === Role.manager) {
      if (target.role === Role.admin || target.role === Role.manager) {
        throw new ForbiddenException(
          'Bạn không có quyền chỉnh sửa tài khoản Admin/Manager',
        );
      }

      // Manager KHÔNG được đổi username
      if (data.username) {
        throw new ForbiddenException('Chỉ admin mới có quyền đổi username');
      }

      // Manager không được gán role khác USER
      if (data.role && data.role !== Role.user) {
        throw new ForbiddenException(
          'Chỉ admin mới có quyền gán role Admin/Manager',
        );
      }
    }

    return this.prisma.user.update({
      where: { id: targetUserId },
      data: {
        full_name: data.full_name,
        username: data.username,
        department: data.department,
        status: data.status,
        role: data.role,
      },
      select: {
        id: true,
        full_name: true,
        username: true,
        role: true,
        department: true,
        status: true,
      },
    });
  }

  /**
   * Xoá user:
   * - Manager: chỉ được xoá user role = 'user'
   * - Admin: xoá được tất cả (nếu anh muốn cấm xoá admin khác thì ta tinh chỉnh sau)
   * - User thường: không được xoá (controller chặn, thêm guard cho chắc)
   */
  async deleteUserWithRoleCheck(params: {
    actorRole: Role;
    targetUserId: string;
  }) {
    const { actorRole, targetUserId } = params;

    const target = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        role: true,
      },
    });

    if (!target) {
      throw new NotFoundException('User không tồn tại');
    }

    if (actorRole === Role.user) {
      throw new ForbiddenException('Bạn không có quyền xoá tài khoản');
    }

    if (actorRole === Role.manager) {
      if (target.role !== Role.user) {
        throw new ForbiddenException(
          'Manager chỉ được phép xoá tài khoản role USER',
        );
      }
    }

    await this.prisma.user.delete({
      where: { id: targetUserId },
    });

    return { ok: true };
  }
  /**
   * Đổi mật khẩu cho 1 user
   * - Chỉ ADMIN được đổi mật khẩu người khác
   * - (Sau này nếu cần user tự đổi mật khẩu, ta làm endpoint khác:
   *   bắt buộc truyền oldPassword + newPassword)
   */
  async updatePasswordWithRoleCheck(params: {
    actorRole: Role;
    targetUserId: string;
    newPassword: string;
  }) {
    const { actorRole, targetUserId, newPassword } = params;

    if (actorRole !== Role.admin) {
      throw new ForbiddenException(
        'Chỉ admin mới có quyền đổi mật khẩu người khác',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true },
    });

    if (!user) {
      throw new NotFoundException('User không tồn tại');
    }

    // hash password mới
    const password_hash = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: targetUserId },
      data: { password_hash },
    });

    return { ok: true };
  }
}
