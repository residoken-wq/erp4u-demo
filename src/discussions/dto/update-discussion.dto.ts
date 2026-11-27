import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateDiscussionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  mentioned_user_ids?: any;
}
