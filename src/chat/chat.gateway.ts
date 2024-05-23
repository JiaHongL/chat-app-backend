import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket, OnGatewayInit } from '@nestjs/websockets';
import { Server } from 'ws';
import { UserService } from '../user/user.service';
import { ApiTags, ApiExtraModels } from '@nestjs/swagger';
import { SendMessageDto, PrivateMessageDto, MarkAsReadDto} from './websocket-docs';
import { NotificationService } from 'src/notification/notification.service';


@ApiTags('chat')
@ApiExtraModels(SendMessageDto, PrivateMessageDto, MarkAsReadDto)
@WebSocketGateway({ 
  server: true 
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private messageHistory = {
    general: [],
    privateMessages: {}
  };

  private unreadMessages = {};

  constructor(
    private userService: UserService,
    private notificationService: NotificationService
  ) {
    this.notificationService.notification$.subscribe(message => {
      if (message ==='updateUserList') {
        this.server.clients.forEach(client => {
          client.send(JSON.stringify({ event: 'updateUserList', data: '' }));
        });
      }
    });
  }

  async handleConnection(client: any, req: any) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      const decoded = this.userService.verifyToken(token);
      await this.userService.autoLogin(token);
      const user = await this.userService.findByUsername(decoded.username);
      client['username'] = user.username;

      console.log(`User ${user.username} connected`);

      // 發送一般聊天歷史
      client.send(JSON.stringify({ event: 'messageHistory', data: { room: 'general', messages: this.messageHistory.general } }));
      
      // 發送未讀消息數量
      client.send(JSON.stringify({ event: 'unreadMessages', data: { room: 'general', count: this.getUnreadCount('general', client['username']) } }));

      // 發送私人訊息歷史和未讀數量
      Object.keys(this.messageHistory).forEach(room => {
        if (room.startsWith('private_') && room.includes(user.username)) {
          client.send(JSON.stringify({ event: 'messageHistory', data: { room, messages: this.messageHistory[room] } }));
          client.send(JSON.stringify({ event: 'unreadMessages', data: { room, count: this.getUnreadCount(room, client['username']) } }));
        }
      });

      // 更新在線用戶列表
      this.updateOnlineUsers();
    } catch (error) {
      client.close();
    }
  }

  async handleDisconnect(client: any) {
    const username = client['username'];
    console.log(`User ${username} disconnected`);
    if (username) {
      await this.userService.logout(username);
      this.updateOnlineUsers();
    }
  }

  @SubscribeMessage('message')
  handleMessage(@MessageBody() data: SendMessageDto, @ConnectedSocket() client: any) {
    data.date = new Date().toISOString();
    this.server.clients.forEach((c: any) => {
      if (c['room'] === data.room) {
        c.send(JSON.stringify({ event: 'message', data }));
      }else if(data.room === 'general') {
        c.send(JSON.stringify({ event: 'message', data }));
      }
    });
    this.messageHistory[data.room] = this.messageHistory[data.room] || [];
    this.messageHistory[data.room].push(data);
    this.updateUnreadCount(data.room, data.sender);
  }
  
  @SubscribeMessage('privateMessage')
  handlePrivateMessage(@MessageBody() data: PrivateMessageDto, @ConnectedSocket() client: any) {
    data.date = new Date().toISOString();
    const room = `private_${data.sender}_${data.to}`;
    const reverseRoom = `private_${data.to}_${data.sender}`;
  
    if (!this.messageHistory[room]) {
      this.messageHistory[room] = [];
    }
    if (!this.messageHistory[reverseRoom]) {
      this.messageHistory[reverseRoom] = [];
    }
  
    this.messageHistory[room].push(data);
    this.messageHistory[reverseRoom].push(data);
  
    let receiverConnected = false;
  
    this.server.clients.forEach((c: any) => {
      if (c['username'] === data.to) {
        receiverConnected = true;
        c.send(JSON.stringify({ event: 'privateMessage', data }));
        this.updateUnreadCount(room, data.sender, data.to);
      } else if (c['username'] === data.sender) {
        c.send(JSON.stringify({ event: 'privateMessage', data }));
      }
    });
  
    // 如果接收者未連接，更新未讀訊息數量
    if (!receiverConnected) {
      this.updateUnreadCount(room, data.sender, data.to);
    }
  }

  @SubscribeMessage('markAsRead')
  handleMarkAsRead(@MessageBody() data: MarkAsReadDto, @ConnectedSocket() client: any) {
    const { room, type } = data;
    const username = client['username'];
    if (this.unreadMessages[room]) {
      this.unreadMessages[room][username] = 0;
    }

    if (type === 'private') {
      this.server.clients.forEach((c: any) => {
        if (c['username'] === username) {
          c.send(JSON.stringify({ event: 'unreadMessages', data: { room, count: this.getUnreadCount(room, username) } }));
        }
      });

    } else {
      this.server.clients.forEach((c: any) => {
        if (c['room'] === room) {
          c.send(JSON.stringify({ event: 'unreadMessages', data: { room, count: this.getUnreadCount(room, c['username']) } }));
        }
      });
    }
  }

  private getUnreadCount(room: string, username: string): number {
    if (!this.unreadMessages[room] || !this.unreadMessages[room][username]) {
      return 0;
    }
    return this.unreadMessages[room][username];
  }

  private async updateUnreadCount(room: string, sender: string, receiver?: string) {

    if (!this.unreadMessages[room]) {
      this.unreadMessages[room] = {};
    }

    if (receiver) {
      // 只更新接收者的未讀訊息數量
      if (!this.unreadMessages[room][receiver]) {
        this.unreadMessages[room][receiver] = 0;
      }
      this.unreadMessages[room][receiver]++;
      const client = Array.from(this.server.clients).find((c: any) => c['username'] === receiver) as any;
      if (client) {
        client.send(JSON.stringify({ event: 'unreadMessages', data: { room, count: this.unreadMessages[room][receiver] } }));
      }
    } else {
      // 獲取所有使用者
      const users = await this.userService.getAllUsers();

      // 更新所有除了發送者之外的用戶的未讀訊息數量
      users.forEach((user) => {
        const username = user.username;
        if (username !== sender) {
          if (!this.unreadMessages[room][username]) {
            this.unreadMessages[room][username] = 0;
          }
          this.unreadMessages[room][username]++;
          // 如果用戶在線，發送未讀訊息數量更新
          if (user.status === 'online') {
            const client = Array.from(this.server.clients).find((c: any) => c['username'] === username) as any;
            if (client) {
              client.send(JSON.stringify({ event: 'unreadMessages', data: { room, count: this.unreadMessages[room][username] } }));
            }
          }
        }
      });
    }
  }

  private async updateOnlineUsers() {
    const onlineUsers = await this.userService.getOnlineUsers();
    this.server.clients.forEach((client: any) => {
      client.send(JSON.stringify({ event: 'onlineUsers', data: { users: onlineUsers } }));
    });
  }
}