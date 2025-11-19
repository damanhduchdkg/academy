import { IsString } from 'class-validator';

export class AttachFileDto {
  @IsString()
  fileId: string;
}
