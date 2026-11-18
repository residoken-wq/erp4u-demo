// src/products/dto/create-variant.dto.ts
import { IsNotEmpty, IsString, IsObject, IsOptional } from 'class-validator';

export class CreateVariantDto {
  @IsNotEmpty()
  @IsString()
  baseSku: string; // SKU của sản phẩm gốc (từ đó copy)

  @IsNotEmpty()
  @IsString()
  newSku: string; // SKU mới được tạo

  @IsString()
  @IsOptional()
  newName: string; // Tên mới

  @IsObject()
  @IsOptional()
  attributes: {
    front_color?: string;
    back_color?: string;
    size?: string;
    logo?: string;
    design?: string;
    [key: string]: any;
  };
}