import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class RefreshToken extends Document {

    @Prop({ required: true, unique: true, index: true })
    jti: string;

    @Prop({ required: true, index: true })
    userId: string;

    @Prop({ required: true, index: true })
    expiresAt: Date;

    @Prop({ default: false, index: true })
    isRevoked: boolean;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

RefreshTokenSchema.index({ jti: 1 }, { unique: true });
RefreshTokenSchema.index({ userId: 1, isRevoked: 1 });
RefreshTokenSchema.index({ expiresAt: 1 }); // For cleanup cron job