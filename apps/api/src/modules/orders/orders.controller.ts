import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  NotFoundException,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

@ApiTags('orders')
@ApiBearerAuth()
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new order and trigger ERP sync' })
  @ApiResponse({ status: 201, description: 'Order created successfully' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  async createOrder(@Body() dto: CreateOrderDto) {
    const order = await this.ordersService.createOrder(dto);
    if (!order) {
      throw new NotFoundException('Failed to create order');
    }
    return { success: true, data: order };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get order by ID' })
  @ApiParam({ name: 'id', description: 'Order UUID' })
  @ApiResponse({ status: 200, description: 'Order found' })
  @ApiResponse({ status: 404, description: 'Order not found' })
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    const order = await this.ordersService.findById(id);
    if (!order) {
      throw new NotFoundException(`Order ${id} not found`);
    }
    return { success: true, data: order };
  }

  @Get()
  @ApiOperation({ summary: 'List orders by vendor (paginated)' })
  @ApiQuery({ name: 'vendorId', required: true, description: 'Vendor UUID' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number (default: 1)' })
  @ApiQuery({ name: 'limit', required: false, description: 'Page size (default: 50, max: 100)' })
  @ApiResponse({ status: 200, description: 'Orders list' })
  async findByVendor(
    @Query('vendorId') vendorId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 50,
  ) {
    const safeLimit = Math.min(Number(limit), 100);
    const result = await this.ordersService.findByVendor(vendorId, Number(page), safeLimit);
    return {
      success: true,
      data: result.data,
      meta: { total: result.total, page: Number(page), limit: safeLimit },
    };
  }
}
