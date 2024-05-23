import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { NotificationService } from 'src/notification/notification.service';

interface User {
  username: string;
  password: string;
  status: 'online' | 'offline';
  avatar?: string;
}

@Injectable()
export class UserService {
  private users: User[] = [
    {
      username: 'joe',
      password: '$2b$10$wT.4KS9AE9J3FzJJLIjyEOuI/qs3IfJinYv044ab/66kIy34NRhI.',
      status: 'offline',
      avatar: 'https://api.dicebear.com/8.x/pixel-art/svg?seed=joe'
    },
    {
      username: 'jane',
      password: '$2b$10$wT.4KS9AE9J3FzJJLIjyEOuI/qs3IfJinYv044ab/66kIy34NRhI.',
      status: 'offline',
      avatar: 'https://api.dicebear.com/8.x/pixel-art/svg?seed=jane'
    },
    {
      username: 'john',
      password: '$2b$10$wT.4KS9AE9J3FzJJLIjyEOuI/qs3IfJinYv044ab/66kIy34NRhI.',
      status: 'offline',
      avatar: 'https://api.dicebear.com/8.x/pixel-art/svg?seed=john'
    },
    {
      username: 'linda',
      password: '$2b$10$wT.4KS9AE9J3FzJJLIjyEOuI/qs3IfJinYv044ab/66kIy34NRhI.',
      status: 'offline',
      avatar: 'https://api.dicebear.com/8.x/pixel-art/svg?seed=linda'
    },
    {
      username: 'david',
      password: '$2b$10$wT.4KS9AE9J3FzJJLIjyEOuI/qs3IfJinYv044ab/66kIy34NRhI.',
      status: 'offline',
      avatar: 'https://api.dicebear.com/8.x/pixel-art/svg?seed=david'
    }
  ];

  constructor(
    private jwtService: JwtService,
    private notificationService: NotificationService
  ) {}

  async register(username: string, password: string): Promise<void> {
    if (!username || !password) {
      throw new HttpException('Invalid input', HttpStatus.BAD_REQUEST);
    }
    if (this.users.find(u => u.username === username)) {
      throw new HttpException('User already exists', HttpStatus.CONFLICT);
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    this.users.push({ 
      username, 
      password: hashedPassword, 
      status: 'offline',
      avatar: `https://api.dicebear.com/8.x/pixel-art/svg?seed=${username}` 
    });
    this.notificationService.notify('updateUserList');
  }

  async login(username: string, password: string): Promise<string> {
    const user = this.users.find(u => u.username === username);
    if (user && await bcrypt.compare(password, user.password)) {
      user.status = 'online';
      return this.jwtService.sign({ username });
    }
    throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
  }

  async autoLogin(token: string): Promise<string> {
    const { username } = this.verifyToken(token);
    const user = this.users.find(u => u.username === username);
    if (user) {
      user.status = 'online';
      return token;
    }
    throw new HttpException('Invalid token', HttpStatus.UNAUTHORIZED);
  }

  async logout(username: string): Promise<void> {
    const user = this.users.find(u => u.username === username);
    if (user) {
      user.status = 'offline';
    }
  }

  async findByUsername(username: string): Promise<User> {
    return this.users.find(u => u.username === username);
  }

  async getOnlineUsers(): Promise<string[]> {
    return this.users.filter(user => user.status === 'online').map(user => user.username);
  }

  async getAllUsers(): Promise<User[]> {
    return this.users;
  }

  verifyToken(token: any): any {
    return this.jwtService.verify(token);
  }
}
