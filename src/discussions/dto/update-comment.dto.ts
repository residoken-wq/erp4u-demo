import { IsNotEmpty, IsString } from 'class-validator';

export class UpdateDiscussionCommentDto {
  @IsNotEmpty()
  @IsString()
  content: string;
}
