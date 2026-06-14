import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class User extends Document {

    @Prop({
        required: false,
        unique: true,
        sparse: true,
        trim: true,
        match: /^\S+@\S+\.\S+$/
    })
    email?: string;

    @Prop({
        required: false,
        select: false
    })
    password?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
    },
});
