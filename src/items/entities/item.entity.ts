import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { List } from '../../lists/entities/list.entity';
import * as mongoose from 'mongoose';

export type ItemDocument = Item & Document;

@Schema({ timestamps: true })
export class Item {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  category: string;

  @Prop({ default: false })
  checked: boolean;

  @Prop()
  price: number;

  @Prop()
  unit: string;

  @Prop()
  quantity: number;

  @Prop()
  description: string;

  @Prop({ type: mongoose.Schema.Types.ObjectId, ref: 'List' })
  list: List;
}

export const ItemSchema = SchemaFactory.createForClass(Item);
