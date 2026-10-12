import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class SaveCredentialDto {
  @ApiProperty({
    minLength: 20,
    maxLength: 200,
    description: 'Provider API key (never returned by the API)',
  })
  @IsString()
  @MinLength(20)
  @MaxLength(200)
  apiKey!: string;
}

export class CredentialMetadataDto {
  @ApiProperty({ example: 'gemini' })
  provider!: string;

  @ApiProperty({ example: 'AB12', description: 'Last 4 characters only' })
  keyHint!: string;

  @ApiProperty({ enum: ['active', 'revoked'] })
  status!: string;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;

  @ApiPropertyOptional()
  rotatedAt?: string;
}
