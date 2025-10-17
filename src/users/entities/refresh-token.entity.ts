import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class RefreshToken extends Document {

    @Prop({ required: true })
    jti: string;

    @Prop({ required: true })
    userId: string;

    @Prop({ required: true })
    expiresAt: Date;

    @Prop({ default: false })
    isRevoked: boolean;
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);

RefreshTokenSchema.index({ jti: 1 }, { unique: true });
RefreshTokenSchema.index({ userId: 1, isRevoked: 1 });
RefreshTokenSchema.index({ expiresAt: 1 }); // For cleanup cron job