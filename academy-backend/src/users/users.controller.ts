// src/users/users-admin.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { Role } from '../auth/roles.enum';
import { CreateUserAdminDto } from './dto/create-user-admin.dto';

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Controller('users/admin')
export class UsersAdminController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users/admin  → danh sách user
  @Get()
  @Roles(Role.admin, Role.manager)
  async listUsers() {
    return this.usersService.listUsers();
  }

  // GET /users/admin/:id  → chi tiết 1 user
  @Get(':id')
  @Roles(Role.admin, Role.manager)
  async getUser(@Param('id') id: string) {
    return this.usersService.getUserById(id);
  }

  // POST /users/admin  → tạo user (anh đã test ok)
  @Post()
  @Roles(Role.admin, Role.manager)
  async createUser(@Req() req: any, @Body() dto: CreateUserAdminDto) {
    const actorRole = req.user.role as Role;
    const bcrypt = (await import('bcrypt')).default;
    const password_hash = await bcrypt.hash(dto.password, 10);

    return this.usersService.createUserWithRoleCheck({
      actorRole,
      data: {
        full_name: dto.full_name,
        username: dto.username,
        password_hash,
        role: dto.role as Role,
        department: dto.department ?? null,
      },
    });
  }

  // PATCH /users/admin/:id  → cập nhật user
  @Patch(':id')
  @Roles(Role.admin, Role.manager)
  async updateUser(
    @Req() req: any,
    @Param('id') userId: string,
    @Body()
    body: {
      full_name?: string;
      username?: string;
      department?: string;
      status?: 'active' | 'inactive';
      role?: Role;
    },
  ) {
    const actorRole: Role = req.user.role;

    return this.usersService.updateUserWithRoleCheck({
      actorRole,
      targetUserId: userId,
      data: {
        full_name: body.full_name,
        username: body.username,
        department: body.department,
        status: body.status,
        role: body.role,
      },
    });
  }

  // DELETE /users/admin/:id  → xoá user
  @Delete(':id')
  @Roles(Role.admin, Role.manager)
  async deleteUser(@Req() req: any, @Param('id') userId: string) {
    const actorRole: Role = req.user.role;

    return this.usersService.deleteUserWithRoleCheck({
      actorRole,
      targetUserId: userId,
    });
  }

  /**
   * Admin đổi mật khẩu cho user
   * PATCH /users/admin/:id/password
   * body: { "newPassword": "..." }
   */
  @Patch(':id/password')
  @Roles(Role.admin) // chỉ admin
  async changePasswordForUser(
    @Req() req: any,
    @Param('id') userId: string,
    @Body() body: { password: string },
  ) {
    const actorRole: Role = req.user.role;

    return this.usersService.updatePasswordWithRoleCheck({
      actorRole,
      targetUserId: userId,
      newPassword: body.password,
    });
  }
}
