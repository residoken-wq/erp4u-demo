import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  Min,
  Max,
  ValidateNested,
  IsArray,
  ArrayMaxSize,
  IsEmail,
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { Type } from 'class-transformer';

import {
  checkGreeting,
  checkNoSecret,
  checkDaySchedule,
  AVATAR_URL_REGEX,
  HOTLINE_REGEX,
} from './chatbot-config.validator';

export function IsGreetingValid(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isGreetingValid',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, _args: ValidationArguments) {
          return checkGreeting(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be <= 300 chars and only contain placeholders {short_name} or {display_name}`;
        },
      },
    });
  };
}

export function IsValidDaySchedule(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isValidDaySchedule',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, _args: ValidationArguments) {
          return checkDaySchedule(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} schedule is invalid (must have valid time step and from < to when active)`;
        },
      },
    });
  };
}

export function IsNoSecret(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNoSecret',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, _args: ValidationArguments) {
          return checkNoSecret(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} contains prohibited secret-like content`;
        },
      },
    });
  };
}

export class ContactChannelsDto {
  @IsOptional()
  @IsString()
  @Matches(/^$|^[\d\s+\-,.]{8,50}$/, { message: 'hotline must be 8-50 digits, spaces, dashes, commas, or +' })
  @IsNoSecret()
  hotline?: string;

  @IsOptional()
  @IsString()
  @Matches(/^$|^https:\/\/[^\s<>"']+$/, { message: 'zalo_url must start with https://' })
  @IsNoSecret()
  zalo_url?: string;

  @IsOptional()
  @IsString()
  @Matches(/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, { message: 'email_public must be a valid email' })
  @IsNoSecret()
  email_public?: string;

  @IsOptional()
  @IsString()
  @Matches(/^$|^https:\/\/[^\s<>"']+$/, { message: 'messenger_url must start with https://' })
  @IsNoSecret()
  messenger_url?: string;
}

export class DayScheduleDto {
  @IsBoolean()
  off: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):(00|15|30|45)$/, {
    message: 'from must be HH:mm with 15-minute step',
  })
  from?: string;

  @IsOptional()
  @IsString()
  @Matches(/^([01]\d|2[0-3]):(00|15|30|45)$/, {
    message: 'to must be HH:mm with 15-minute step',
  })
  to?: string;
}

export class WorkingHoursDaysDto {
  @ValidateNested()
  @Type(() => DayScheduleDto)
  @IsValidDaySchedule()
  mon: DayScheduleDto;

  @ValidateNested()
  @Type(() => DayScheduleDto)
  @IsValidDaySchedule()
  tue: DayScheduleDto;

  @ValidateNested()
  @Type(() => DayScheduleDto)
  @IsValidDaySchedule()
  wed: DayScheduleDto;

  @ValidateNested()
  @Type(() => DayScheduleDto)
  @IsValidDaySchedule()
  thu: DayScheduleDto;

  @ValidateNested()
  @Type(() => DayScheduleDto)
  @IsValidDaySchedule()
  fri: DayScheduleDto;

  @ValidateNested()
  @Type(() => DayScheduleDto)
  @IsValidDaySchedule()
  sat: DayScheduleDto;

  @ValidateNested()
  @Type(() => DayScheduleDto)
  @IsValidDaySchedule()
  sun: DayScheduleDto;
}

export class WorkingHoursDto {
  @IsOptional()
  @IsString()
  tz?: string;

  @ValidateNested()
  @Type(() => WorkingHoursDaysDto)
  days: WorkingHoursDaysDto;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @IsNoSecret()
  holiday_note?: string;
}

export class FeaturesDto {
  @IsOptional()
  @IsBoolean()
  price_estimate?: boolean;

  @IsOptional()
  @IsBoolean()
  order_lookup?: boolean;

  @IsOptional()
  @IsBoolean()
  attachments?: boolean;

  @IsOptional()
  @IsBoolean()
  sample_request?: boolean;
}

export class LimitsDto {
  @IsInt()
  @Min(1)
  @Max(500)
  session_per_ip_hour: number;

  @IsInt()
  @Min(1)
  @Max(200)
  msg_per_session_5m: number;

  @IsInt()
  @Min(1)
  @Max(1000)
  msg_per_ip_5m: number;

  @IsInt()
  @Min(1)
  @Max(100)
  submit_per_session_hour: number;

  @IsInt()
  @Min(1)
  @Max(100)
  upload_per_session_hour: number;

  @IsInt()
  @Min(1)
  @Max(50)
  llm_concurrency: number;

  @IsInt()
  @Min(1)
  @Max(1440)
  unassigned_alert_min: number;

  @IsInt()
  @Min(100)
  @Max(10000)
  max_message_chars: number;
}

export class RetentionDaysDto {
  @IsInt()
  @Min(1)
  @Max(3650)
  chat: number;

  @IsInt()
  @Min(1)
  @Max(3650)
  attachment: number;

  @IsInt()
  @Min(1)
  @Max(3650)
  request: number;

  @IsInt()
  @Min(1)
  @Max(3650)
  ticket: number;

  @IsInt()
  @Min(1)
  @Max(3650)
  audit: number;
}

export class LlmConfigDto {
  @IsInt()
  @Min(1)
  @Max(100000)
  daily_call_budget: number;

  @IsInt()
  @Min(1000)
  @Max(120000)
  timeout_ms: number;
}

export class ChatbotConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsString()
  @Length(2, 60)
  @Matches(/^[^<>{}]*$/, { message: 'display_name cannot contain <, >, {, }' })
  @IsNoSecret()
  display_name: string;

  @IsString()
  @Length(2, 30)
  @Matches(/^[^<>{}]*$/, { message: 'short_name cannot contain <, >, {, }' })
  @IsNoSecret()
  short_name: string;

  @IsString()
  @Matches(AVATAR_URL_REGEX, { message: 'avatar_url must start with / (not //) or https://' })
  @IsNoSecret()
  avatar_url: string;

  @IsString()
  @IsGreetingValid()
  @IsNoSecret()
  greeting: string;

  @ValidateNested()
  @Type(() => ContactChannelsDto)
  contact_channels: ContactChannelsDto;

  @ValidateNested()
  @Type(() => WorkingHoursDto)
  working_hours: WorkingHoursDto;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  @IsNoSecret()
  response_sla_text?: string;

  @IsArray()
  @ArrayMaxSize(10)
  @IsEmail({}, { each: true })
  notify_emails: string[];

  @IsArray()
  @IsInt({ each: true })
  notify_user_ids: number[];

  @IsOptional()
  @ValidateNested()
  @Type(() => FeaturesDto)
  features?: FeaturesDto;

  @ValidateNested()
  @Type(() => LimitsDto)
  limits: LimitsDto;

  @ValidateNested()
  @Type(() => RetentionDaysDto)
  retention_days: RetentionDaysDto;

  @ValidateNested()
  @Type(() => LlmConfigDto)
  llm: LlmConfigDto;
}
