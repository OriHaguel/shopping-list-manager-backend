import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { Item, ItemDocument } from './entities/item.entity';
import { ListsService } from '../lists/lists.service';

@Injectable()
export class ItemsService {
  constructor(
    @InjectModel(Item.name) private itemModel: Model<ItemDocument>,
    private readonly listsService: ListsService,
  ) {}

  async create(createItemDto: CreateItemDto, userId: string): Promise<ItemDocument> {
    const list = await this.listsService.findOne(createItemDto.listId, userId);
    if (!list) {
      throw new NotFoundException('List not found');
    }
    const createdItem = new this.itemModel({
      ...createItemDto,
      list: list._id,
    });
    return createdItem.save();
  }

  async findAll(listId: string, userId: string): Promise<ItemDocument[]> {
    const list = await this.listsService.findOne(listId, userId);
    if (!list) {
      throw new NotFoundException('List not found');
    }
    return this.itemModel.find({ list: list._id }).exec();
  }

  async findOne(id: string, userId: string): Promise<ItemDocument> {
    const item = await this.itemModel.findById(id).exec();
    if (!item) {
      throw new NotFoundException('Item not found');
    }
    await this.listsService.findOne(item.list.toString(), userId);
    return item;
  }

  async update(id: string, updateItemDto: UpdateItemDto, userId: string): Promise<ItemDocument> {
    const item = await this.findOne(id, userId);
    Object.assign(item, updateItemDto);
    return item.save();
  }

  async remove(id: string, userId: string): Promise<any> {
    const item = await this.findOne(id, userId);
    return this.itemModel.deleteOne({ _id: item._id }).exec();
  }
}