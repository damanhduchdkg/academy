// src/auth/auth.controller.ts
import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { Public } from './public.decorator';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Đăng nhập: nhận username/password từ body JSON
  @Public()
  @Post('login')
  async login(@Body() body: { username: string; password: string }) {
    const { username, password } = body;
    return this.authService.login(username, password);
  }

  // Lấy thông tin user hiện tại từ token
  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    // payload đã được JwtStrategy validate và gắn vào req.user
    return {
      id: req.user.user_id,
      full_name: req.user.full_name,
      role: req.user.role,
    };
  }
}
