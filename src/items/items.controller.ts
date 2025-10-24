import { Controller, Get, Post, Body, Param, Delete, UseGuards, Req, Put } from '@nestjs/common';
import { ItemsService } from './items.service';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { JwtAuthGuard } from '../users/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('api/items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) { }

  @Post()
  create(@Body() createItemDto: CreateItemDto, @Req() req) {
    return this.itemsService.create(createItemDto, req.user.userId);
  }

  @Get('all/:listId')
  findAll(@Param('listId') listId: string, @Req() req) {
    return this.itemsService.findAll(listId, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req) {
    return this.itemsService.findOne(id, req.user.userId);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() updateItemDto: UpdateItemDto, @Req() req) {
    return this.itemsService.update(id, updateItemDto, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req) {
    return this.itemsService.remove(id, req.user.userId);
  }
}