import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

interface User {
  username: string;
  password: string;
  status: 'online' | 'offline';
}

@Injectable()
export class UserService {
  private users: User[] = [
    {
      username: 'joe',
      password: '$2b$10$wT.4KS9AE9J3FzJJLIjyEOuI/qs3IfJinYv044ab/66kIy34NRhI.',
      status: 'offline'
    },
    {
      username: 'jane',
      password: '$2b$10$wT.4KS9AE9J3FzJJLIjyEOuI/qs3IfJinYv044ab/66kIy34NRhI.',
      status: 'offline'
    },
    {
      username: 'john',
      password: '$2b$10$wT.4KS9AE9J3FzJJLIjyEOuI/qs3IfJinYv044ab/66kIy34NRhI.',
      status: 'offline'
    },
    {
      username: 'linda',
      password: '$2b$10$wT.4KS9AE9J3FzJJLIjyEOuI/qs3IfJinYv044ab/66kIy34NRhI.',
      status: 'offline'
    },
    {
      username: 'david',
      password: '$2b$10$wT.4KS9AE9J3FzJJLIjyEOuI/qs3IfJinYv044ab/66kIy34NRhI.',
      status: 'offline'
    }
  ];

  constructor(private jwtService: JwtService) {}

  async register(username: string, password: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(password, 10);
    this.users.push({ username, password: hashedPassword, status: 'offline' });
  }

  async login(username: string, password: string): Promise<string> {
    const user = this.users.find(u => u.username === username);
    if (user && await bcrypt.compare(password, user.password)) {
      user.status = 'online';
      return this.jwtService.sign({ username });
    }
    throw new Error('Invalid credentials');
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
