import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateFileDto {
  @IsString()
  @IsOptional()
  file_name?: string;

  @IsBoolean()
  @IsOptional()
  is_active?: boolean;
}
