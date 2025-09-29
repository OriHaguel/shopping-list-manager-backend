import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type RefreshTokenDocument = RefreshToken & Document;

@Schema()
export class RefreshToken {
    @Prop({ required: true, unique: true })
    token: string; // The hashed token string

    @Prop({ type: Types.ObjectId, ref: 'User', required: true })
    userId: Types.ObjectId; // Link to the user

    @Prop({ required: true })
    expiresAt: Date; // Expiration date

    @Prop({ default: false })
    isRevoked: boolean; // Flag to revoke on logout or breach
}

export const RefreshTokenSchema = SchemaFactory.createForClass(RefreshToken);
// Optional: Add an index on expiresAt for cleanup
RefreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });