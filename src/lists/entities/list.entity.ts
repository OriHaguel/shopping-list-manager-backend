import { Schema, SchemaFactory, Prop } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class List extends Document {
    @Prop()
    name: string;

    @Prop({ required: true, select: false })
    userId: string;
}

export const ListSchema = SchemaFactory.createForClass(List);

ListSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.__v;
        return ret;
    },
});


