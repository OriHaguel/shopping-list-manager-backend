import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Req } from '@nestjs/common';
import { ListsService } from './lists.service';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { JwtAuthGuard } from '../users/jwt-auth.guard';
import { Request } from 'express';

@Controller('api/lists')
@UseGuards(JwtAuthGuard)
export class ListsController {
  constructor(private readonly listsService: ListsService) { }

  @Post()
  create(@Body() createListDto: CreateListDto, @Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.listsService.create(createListDto, userId);
  }

  @Get()
  findAll(@Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.listsService.findAll(userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.listsService.findOne(id, userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateListDto: UpdateListDto, @Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.listsService.update(id, updateListDto, userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: Request) {
    const userId = (req.user as any).userId;
    return this.listsService.remove(id, userId);
  }
}
