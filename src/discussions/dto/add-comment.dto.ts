import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AddDiscussionCommentDto {
  @IsNotEmpty()
  @IsString()
  content: string;

  @IsOptional()
  mentioned_user_ids?: any;
}
