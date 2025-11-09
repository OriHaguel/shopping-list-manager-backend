import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { InjectModel } from '@nestjs/mongoose';
import { List } from './entities/list.entity';
import { Model } from 'mongoose';
import { UsersService } from '../users/users.service';

@Injectable()
export class ListsService {
  constructor(
    @InjectModel(List.name) private listModel: Model<List>,
    private readonly usersService: UsersService,
  ) { }

  async create(createListDto: CreateListDto, userId: string): Promise<List> {
    const newList = new this.listModel({
      ...createListDto,
      userId: [userId],
    });
    return newList.save();
  }

  async findAll(userId: string): Promise<List[]> {
    return this.listModel.find({ userId }).exec();
  }

  async findOne(id: string, userId: string): Promise<List> {
    const list = await this.listModel.findOne({ _id: id, userId }).exec();
    if (!list) {
      throw new NotFoundException(`List with ID '${id}' not found`);
    }
    return list;
  }

  async update(id: string, updateListDto: UpdateListDto, userId: string): Promise<List> {
    const existingList = await this.listModel.findOneAndUpdate({ _id: id, userId }, updateListDto, { new: true }).exec();
    if (!existingList) {
      throw new NotFoundException(`List with ID '${id}' not found`);
    }
    return existingList;
  }

  async remove(id: string, userId: string): Promise<{ message: string }> {
    const result = await this.listModel.deleteOne({ _id: id, userId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`List with ID '${id}' not found`);
    }
    return { message: `List with ID '${id}' has been successfully deleted` };
  }

  async addUser(id: string, email: string, currentUserId: string): Promise<List> {
    const list = await this.listModel.findOne({ _id: id, userId: currentUserId }).select('+userId').exec();

    if (!list) {
      throw new NotFoundException(`List with ID '${id}' not found or you don't have permission to modify it.`);
    }
    const userToAdd = await this.usersService.findByEmail(email);

    if (!userToAdd) {
      throw new NotFoundException(`User with email '${email}' not found`)
    }
    const newUserId = userToAdd._id.toString();

    if (list.userId.includes(newUserId)) {
      return list;
    }

    list.userId.push(newUserId);

    return list.save();
  }
}
