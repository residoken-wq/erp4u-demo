import { IsBoolean } from 'class-validator';

export class PinDiscussionDto {
  @IsBoolean()
  pinned: boolean;
}
