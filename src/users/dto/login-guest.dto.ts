import { IsString, IsNotEmpty } from 'class-validator';

export class LoginGuestDto {
    @IsString()
    @IsNotEmpty()
    userId: string;
}
