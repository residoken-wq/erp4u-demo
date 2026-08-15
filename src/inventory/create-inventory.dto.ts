import { IsNotEmpty, IsEnum, IsNumber, IsString, IsOptional } from 'class-validator';

export class CreateInventoryDto {
  @IsNotEmpty()
  @IsEnum(['IMPORT', 'EXPORT'])
  type: 'IMPORT' | 'EXPORT';

  @IsNotEmpty()
  @IsEnum(['PRODUCT', 'MATERIAL'])
  itemType: 'PRODUCT' | 'MATERIAL';

  @IsNotEmpty()
  @IsNumber()
  itemId: number;

  // --- MỚI: BẮT BUỘC CHỌN KHO ---
  @IsNotEmpty({ message: 'Vui lòng chọn Kho!' })
  @IsString()
  warehouse: string;
  // -----------------------------

  @IsNotEmpty()
  @IsNumber()
  quantity: number;

  @IsOptional()
  @IsString()
  ref?: string;

  @IsOptional()
  @IsString()
  note?: string;
}