import { IsEmail, IsNotEmpty } from 'class-validator';

export class AddUserToListDto {
    @IsEmail()
    @IsNotEmpty()
    email: string;
}
