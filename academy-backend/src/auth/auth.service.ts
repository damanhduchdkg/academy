import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  // Kiểm tra username/password
  async validateUser(username: string, password: string) {
    // 1. tìm user
    const user = await this.usersService.findByUsername(username);
    if (!user) {
      throw new UnauthorizedException('Sai username hoặc password');
    }

    // 2. check active
    if (user.status !== 'active') {
      throw new UnauthorizedException('Tài khoản đã bị khóa');
    }

    // 3. so sánh hash
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) {
      throw new UnauthorizedException('Sai username hoặc password');
    }

    return user;
  }

  // Đăng nhập: validate user -> ghi log -> ký JWT -> trả token
  async login(username: string, password: string) {
    const user = await this.validateUser(username, password);

    // cập nhật last_login_at
    await this.usersService.updateLastLogin(user.id);

    // ghi activity log LOGIN
    await this.prisma.activityLog.create({
      data: {
        user_id: user.id,
        action: 'LOGIN',
        target_type: 'user',
        target_id: user.id,
      },
    });

    // nội dung đưa vào token
    const payload = {
      user_id: user.id,
      role: user.role,
      full_name: user.full_name,
    };

    // ký token
    const accessToken = await this.jwtService.signAsync(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        full_name: user.full_name,
        role: user.role,
      },
    };
  }
}
