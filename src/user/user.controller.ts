import { Controller, Post, Body, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiBody, ApiProperty } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from './jwt-auth.guard';

export class TokenDto {
  @ApiProperty()
  token: string;
}

export class UserInfoDto {
  @ApiProperty()
  "username": string;
  @ApiProperty()
  "status": string
  @ApiProperty()
  "avatar": string;
}

@ApiTags('users')
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) { }

  @ApiOperation({ summary: '註冊' })
  @ApiBody({ schema: { properties: { username: { type: 'string' }, password: { type: 'string' } } } })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @Post('register')
  async register(@Body('username') username: string, @Body('password') password: string) {
    await this.userService.register(username, password);
    return { message: 'User registered successfully' };
  }

  @ApiOperation({ summary: '登入' })
  @ApiBody({
    schema: {
      properties: {
        username: { type: 'string', example: 'joe' }, 
        password: { type: 'string', example: 'abc' } 
      }
    }
  })
  @ApiResponse({
    status: 200,
    description: 'User logged in successfully',
    type: TokenDto
  })
  @Post('login')
  async login(@Body('username') username: string, @Body('password') password: string) {
    const token = await this.userService.login(username, password);
    return { token };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '獲取使用者資訊' })
  @ApiResponse({
    status: 200,
    description: 'Return current user info',
    type: UserInfoDto
  })
  @Get('me')
  async getMe(@Req() req) {
    const user = await this.userService.findByUsername(req.user.username);
    return {
      username: user.username,
      status: user.status,
      avatar: user.avatar
    };
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: '獲取所有使用者' })
  @ApiResponse({
    status: 200,
    description: 'Return all users',
    type: UserInfoDto,
    isArray: true
  })
  @Get()
  async getUsers() {
    const users = await this.userService.getAllUsers();
    return users.map(user => ({ 
      username: user.username, 
      status: user.status,
      avatar: user.avatar 
    }));
  }

  @ApiOperation({ summary: '伺服器資料還原' })
  @ApiResponse({ status: 200, description: 'Server data reset successfully' })
  @Get('reset')
  async reset() {
    await this.userService.reset();
    return { message: 'User registered successfully' };
  }

}

