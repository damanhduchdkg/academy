import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    // req.user được set bởi JwtStrategy.validate()
    if (!req.user) {
      throw new ForbiddenException('Not authenticated');
    }
    if (req.user.role !== 'admin') {
      throw new ForbiddenException('Admin only');
    }
    return true;
  }
}
