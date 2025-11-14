import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';

// class LoginDto {
//   username: string;
//   password: string;
// }

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Đăng nhập: trả về accessToken + thông tin user
  @Post('login')
  async login(@Body() dto: LoginDto) {
    // const { username, password } = body;
    // return this.authService.login(username, password);
    return this.authService.login(dto.username, dto.password);
  }

  // Lấy thông tin user hiện tại từ token
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async me(@Req() req: any) {
    return {
      id: req.user.user_id,
      full_name: req.user.full_name,
      role: req.user.role,
    };
  }
}
