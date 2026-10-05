import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsInt,
  IsBoolean,
  Min,
  IsDateString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVisitorRequestDto {
  @ApiProperty({ example: 'Ramesh Sharma' })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({ example: '9876543210' })
  @IsString()
  @IsNotEmpty()
  mobile: string;

  @ApiProperty({ example: 'ramesh@example.com', required: false })
  @IsEmail()
  @IsOptional()
  email?: string;

  @ApiProperty({ example: 'Guest', required: false })
  @IsString()
  @IsOptional()
  visitorType?: string;

  @ApiProperty({ example: 'Aadhaar Card' })
  @IsString()
  @IsNotEmpty()
  idType: string;

  @ApiProperty({ example: 'XXXXXXXX1234' })
  @IsString()
  @IsNotEmpty()
  idNumber: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  organization?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  address?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  photoUrl?: string;

  @ApiProperty({ example: 'Official Meeting' })
  @IsString()
  @IsNotEmpty()
  purpose: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  purposeDetail?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  hostId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  hostName?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  departmentId?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  departmentName?: string;

  @ApiProperty({ example: '2026-10-05' })
  @IsDateString()
  @IsNotEmpty()
  visitDate: string;

  @ApiProperty({ example: '10:30' })
  @IsString()
  @IsNotEmpty()
  visitTime: string;

  @ApiProperty({ example: '30 minutes', required: false })
  @IsString()
  @IsOptional()
  expectedDuration?: string;

  @ApiProperty({ example: 1, required: false })
  @IsInt()
  @Min(1)
  @IsOptional()
  numberOfVisitors?: number;

  @ApiProperty({ example: false, required: false })
  @IsBoolean()
  @IsOptional()
  vehicleRequired?: boolean;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  vehicleNumber?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}

export class ApproveRejectRequestDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  reason?: string;
}
