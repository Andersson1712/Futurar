import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import {
  AUDIENCES,
  STORY_SIZES,
  type Audience,
  type StorySize,
} from '../../ai/domain/book-generation.types';
import {
  FONT_SIZES,
  INPUT_MODES,
  LINE_HEIGHTS,
  VOICE_GENDERS,
  type FontSize,
  type InputMode,
  type LineHeight,
  type VoiceGender,
} from '../profile-settings.types';

const toBoolean = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value === 'boolean') return value;

  return value === 'true' || value === '1';
};

export class ListProfilesQueryDto {
  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  active?: boolean;
}

export class CreateProfileDto {
  @ApiProperty({ maxLength: 80 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name!: string;

  @ApiPropertyOptional({ minimum: 3, maximum: 120 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(120)
  age?: number;

  @ApiPropertyOptional({ example: '2016-04-12' })
  @IsOptional()
  @IsDateString()
  birthdate?: string;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  avatarIcon?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateProfileDto {
  @ApiPropertyOptional({ maxLength: 80 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  name?: string;

  @ApiPropertyOptional({ minimum: 3, maximum: 120 })
  @IsOptional()
  @IsInt()
  @Min(3)
  @Max(120)
  age?: number;

  @ApiPropertyOptional({ example: '2016-04-12' })
  @IsOptional()
  @IsDateString()
  birthdate?: string;

  @ApiPropertyOptional({ maxLength: 40 })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  avatarIcon?: string;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ProfileModulesDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  create?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  library?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  design?: boolean;
}

export class SaveProfileSettingsDto {
  @ApiPropertyOptional({ minimum: 800, maximum: 5000 })
  @IsOptional()
  @IsInt()
  @Min(800)
  @Max(5000)
  scanInterval?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 4 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(4)
  scanColumns?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  voiceFeedback?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  sweepEnabled?: boolean;

  @ApiPropertyOptional({ enum: INPUT_MODES })
  @IsOptional()
  @IsIn([...INPUT_MODES])
  inputMode?: InputMode;

  @ApiPropertyOptional({ enum: LINE_HEIGHTS })
  @IsOptional()
  @IsIn([...LINE_HEIGHTS])
  lineHeight?: LineHeight;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  boldTitles?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  uppercase?: boolean;

  @ApiPropertyOptional({ enum: VOICE_GENDERS })
  @IsOptional()
  @IsIn([...VOICE_GENDERS])
  voiceGender?: VoiceGender;

  @ApiPropertyOptional({ enum: FONT_SIZES })
  @IsOptional()
  @IsIn([...FONT_SIZES])
  fontSize?: FontSize;

  @ApiPropertyOptional({ type: ProfileModulesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ProfileModulesDto)
  modules?: ProfileModulesDto;

  @ApiPropertyOptional({ enum: STORY_SIZES })
  @IsOptional()
  @IsIn([...STORY_SIZES])
  bookStorySize?: StorySize;

  @ApiPropertyOptional({ enum: AUDIENCES })
  @IsOptional()
  @IsIn([...AUDIENCES])
  bookAudience?: Audience;
}
