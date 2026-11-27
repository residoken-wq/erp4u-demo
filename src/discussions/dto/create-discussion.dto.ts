import { IsNotEmpty, IsOptional, IsString, MaxLength, IsInt } from 'class-validator';

export class CreateDiscussionDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  title: string;

  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  @IsInt()
  group_id?: number;

  @IsOptional()
  @IsString()
  type?: string;

  @IsOptional()
  mentioned_user_ids?: any;
}
