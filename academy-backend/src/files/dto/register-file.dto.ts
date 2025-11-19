import { IsNotEmpty, IsOptional, IsString, IsNumber } from 'class-validator';

export class RegisterFileDto {
  @IsString()
  @IsNotEmpty()
  file_name: string;

  @IsString()
  @IsNotEmpty()
  mime_type: string;

  @IsString()
  @IsOptional()
  public_url?: string;

  @IsNumber()
  @IsOptional()
  byte_size?: number; // ⬅️ Thêm vào
}
