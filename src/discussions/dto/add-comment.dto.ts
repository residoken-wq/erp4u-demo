import { IsNotEmpty, IsString } from 'class-validator';

export class AddDiscussionCommentDto {
  @IsNotEmpty()
  @IsString()
  content: string;
}
