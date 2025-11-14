import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

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

  // Tạo user
  async createUser(data: {
    full_name: string;
    username: string;
    password_hash: string;
    role: 'admin' | 'manager' | 'user';
    department: string | null;
  }) {
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
  }
}
