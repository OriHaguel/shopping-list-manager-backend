import { IsArray, IsBoolean, IsString, ValidateNested } from 'class-validator';

export class BulkCheckItemDto {
    @IsString()
    itemId: string;

    @IsBoolean()
    checked: boolean;
}

export class BulkToggleCheckDto {
    @IsArray()
    @ValidateNested({ each: true })
    items: BulkCheckItemDto[];
}
