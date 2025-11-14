import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../admin/admin.guard'; // hoặc AdminGuard nếu bạn dùng guard tên khác
import * as bcrypt from 'bcrypt';

class CreateUserDto {
  full_name: string;
  username: string;
  password: string; // plaintext do admin nhập
  role: 'admin' | 'manager' | 'user';
  department?: string;
}

@UseGuards(AuthGuard('jwt'), AdminGuard)
@Controller('users/admin')
export class UsersAdminController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  async createUser(@Body() body: CreateUserDto) {
    // hash password
    const password_hash = await bcrypt.hash(body.password, 10);

    const user = await this.usersService.createUser({
      full_name: body.full_name,
      username: body.username,
      password_hash,
      role: body.role,
      department: body.department ?? null,
    });

    return user;
  }
}
