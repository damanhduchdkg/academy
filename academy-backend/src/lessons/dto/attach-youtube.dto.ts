import { IsString } from 'class-validator';

export class AttachYoutubeDto {
  @IsString()
  youtubeUrl: string;
}
