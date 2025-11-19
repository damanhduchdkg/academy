import {
  IsString,
  IsNotEmpty,
  MaxLength,
  IsEnum,
  IsOptional,
  MinLength,
} from 'class-validator';
import { Role } from '../../auth/roles.enum';

export class CreateUserAdminDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  full_name: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  username: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  @MaxLength(100)
  password: string;

  @IsEnum(Role)
  role: Role; // 'admin' | 'manager' | 'user'

  @IsOptional()
  @IsString()
  @MaxLength(255)
  department?: string;
  // status: 'active' | 'inactive' | undefined;
}
