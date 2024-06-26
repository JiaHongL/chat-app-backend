import { Controller, Post, Body, Get, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiResponse, ApiBody, ApiProperty } from '@nestjs/swagger';
import { UserService } from './user.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { NotificationService } from 'src/notification/notification.service';
import { Subject } from 'rxjs';
import { FakeData } from './fake-data';

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
  constructor(
    private readonly userService: UserService,
    private readonly notificationService: NotificationService
  ) { }

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
        username: { type: 'string', example: 'Joe' },
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

  @ApiOperation({ summary: '伺服器資料重置' })
  @ApiResponse({ status: 200, description: 'Server data reset successfully' })
  @Get('reset')
  async reset() {
    await this.userService.reset();
    return { message: 'User registered successfully' };
  }

  @ApiOperation({ summary: '匯出伺服器資料' })
  @ApiResponse({ status: 200, description: 'Export server data successfully' })
  @Get('export')
  export() {
    let responseSubject = new Subject();
    this.notificationService.notification$.subscribe(data => {
      console.log('notificationService', data);
      if (
        data.event === 'ResponseChatData'
      ) {
        setTimeout(() => {
          responseSubject.next({
            users: this.userService.users,
            ...data.data
          });
          responseSubject.complete();
        });
      }
    });
    this.notificationService.notify({ event: 'RequestChatData', data: '' });
    return responseSubject.asObservable();
  }

  @ApiOperation({ summary: '匯入伺服器資料' })
  @ApiBody({
    schema: {
      properties: {
        users: { type: 'array', items: { type: 'object' } },
        messageHistory: { type: 'array', items: { type: 'object' } },
        unreadMessages: { type: 'array', items: { type: 'object' } }
      },
      example: FakeData
    },
  })
  @ApiResponse({ status: 200, description: 'Import server data successfully' })
  @Post('import')
  import(@Body() data: any) {
    this.notificationService.notify({ event: 'ImportChatData', data });
    return { message: 'Import server data successfully' };
  }

}