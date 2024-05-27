import { WebSocketGateway, WebSocketServer, SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect, MessageBody, ConnectedSocket, OnGatewayInit } from '@nestjs/websockets';
import { Server } from 'ws';
import { UserService } from '../user/user.service';
import { ApiTags, ApiExtraModels } from '@nestjs/swagger';
import { SendMessageDto, PrivateMessageDto, MarkAsReadDto } from './websocket-docs';
import { NotificationService } from 'src/notification/notification.service';


@ApiTags('chat')
@ApiExtraModels(SendMessageDto, PrivateMessageDto, MarkAsReadDto)
@WebSocketGateway({
  server: true,
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  messageHistory = {
    general: []
  };

  unreadMessages = {};

  constructor(
    private userService: UserService,
    private notificationService: NotificationService
  ) {
    this.notificationService.notification$.subscribe(message => {
      if(message.event === 'resetData') {
        this.messageHistory = {
          general: []
        };
        this.unreadMessages = {};
        return;
      }
      if (message.event === 'RequestChatData') {
        this.notificationService.notify({ 
          event: 'ResponseChatData', 
          data: {
            messageHistory: this.messageHistory,
            unreadMessages: this.unreadMessages
          }
        });
        return;
      }
      if (message.event === 'ImportChatData') {
        this.messageHistory = message.data.messageHistory;
        this.unreadMessages = message.data.unreadMessages;
        return;
      }
      this.server.clients.forEach(client => {
        client.send(JSON.stringify(message));
      });
    });
  }

  async handleConnection(client: any, req: any) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const token = url.searchParams.get('token');
      const decoded = await this.userService.verifyToken(token); // 使用 await 確保非阻塞
      await this.userService.autoLogin(token);
      const user = await this.userService.findByUsername(decoded.username);
      client['username'] = user.username;

      // 發送大廳未讀消息數量
      client.send(JSON.stringify({ event: 'unreadMessages', data: { room: 'general', count: this.getUnreadCount('general', client['username']) } }));

      // 發送大廳聊天室的每個人的未讀消息資訊
      client.send(JSON.stringify({ event: 'generalUnReadInfo', data: this.unreadMessages['general']||{}}));

      // 發送私人訊息歷史和未讀數量
      Object.keys(this.messageHistory).forEach(room => {
        if (room.startsWith('private_') && room.includes(user.username)) {
          client.send(JSON.stringify({ event: 'messageHistory', data: { room, messages: this.messageHistory[room] } }));
          const receiver = room.split('_')[2];
          client.send(JSON.stringify({ event: 'unreadMessages', data: { room, count: this.getUnreadCount(room, receiver) } }));
        }
      });

      // 更新在線用戶列表
      this.updateOnlineUsers();

      // 發送大廳聊天歷史
      setTimeout(() => {
        client.send(JSON.stringify({ event: 'messageHistory', data: { room: 'general', messages: this.messageHistory.general } }));
        setTimeout(() => {
          // 通知客戶端連接成功
          client.send(JSON.stringify({ event: 'initializationComplete', data: { message : 'Relevant initialization data has been sent' } }));
          console.log('=================================================================================');
          console.log(`>> User ${user.username} connected`);     
        });
      }, 200);

    } catch (error) {
      client.close();
    }
  }

  async handleDisconnect(client: any) {
    console.log('=================================================================================');
    const username = client['username'];
    console.log(`User ${username} disconnected`);
    // 檢查是否有用戶在線 (同時登入多個網頁)
    let online = false;
    this.server.clients.forEach(c => {
      if (c['username'] === username) {
        online = true;
      }
    });
    if (!online) {
      await this.userService.logout(username);
      this.updateOnlineUsers();
    }
  }

  @SubscribeMessage('message')
  handleMessage(@MessageBody() data: SendMessageDto, @ConnectedSocket() client: any) {
    console.log('=================================================================================');
    console.log('>> handleMessage data', data);
    data.date = new Date().toISOString();
    this.server.clients.forEach((c: any) => {
      if (c['room'] === data.room) {
        c.send(JSON.stringify({ event: 'message', data }));
      } else if (data.room === 'general') {
        c.send(JSON.stringify({ event: 'message', data }));
      }
    });
    this.messageHistory[data.room] = this.messageHistory[data.room] || [];
    this.messageHistory[data.room].push(data);
    this.updateUnreadCount(data.room, data.sender);
    console.log('>> handleMessage messageHistory', this.messageHistory);
  }

  @SubscribeMessage('privateMessage')
  handlePrivateMessage(@MessageBody() data: PrivateMessageDto, @ConnectedSocket() client: any) {
    console.log('=================================================================================');
    console.log('>> handlePrivateMessage data', data);
    data.date = new Date().toISOString();

    let roomData = JSON.parse(JSON.stringify(data)); // 用戶的房間
    roomData.room = `private_${data.sender}_${data.to}`;

    let reverseRoomData = JSON.parse(JSON.stringify(data));  // 對方的房間
    reverseRoomData.room = `private_${data.to}_${data.sender}`;

    if (!this.messageHistory[roomData.room]) { // 如果房間不存在，則創建一個新的
      this.messageHistory[roomData.room] = [];
    }

    if (!this.messageHistory[reverseRoomData.room]) { // 如果房間不存在，則創建一個新的
      this.messageHistory[reverseRoomData.room] = [];
    }

    if (
      data.sender === data.to
    ) { // 如果發送者和接收者是同一個人
      this.messageHistory[roomData.room].push(roomData);
    } else {
      this.messageHistory[roomData.room].push(roomData);
      this.messageHistory[reverseRoomData.room].push(reverseRoomData);
    }

    console.log('>> handlePrivateMessage messageHistory', this.messageHistory);

    // 自己傳給自己的訊息不計算未讀訊息數量
    if (data.sender === data.to) {
      client.send(JSON.stringify({ event: 'privateMessage', data: roomData }));
      return;
    }

    this.server.clients.forEach((c: any) => {
      if (c['username'] === data.to) { // 如果接收者連接
        c.send(JSON.stringify({ event: 'privateMessage', data: roomData }));
        c.send(JSON.stringify({ event: 'privateMessage', data: reverseRoomData }));
      } else if (c['username'] === data.sender) { // 如果發送者連接
        c.send(JSON.stringify({ event: 'privateMessage', data: roomData }));
        c.send(JSON.stringify({ event: 'privateMessage', data: reverseRoomData }));
      }
    });

    this.updateUnreadCount(roomData.room, roomData.sender, roomData.to);
  }

  @SubscribeMessage('markAsRead')
  handleMarkAsRead(@MessageBody() data: MarkAsReadDto, @ConnectedSocket() client: any) {
    console.log('=================================================================================');
    console.log('>> handleMarkAsRead data', data);
    const { room, type } = data;
    const username = client['username'];
    if (this.unreadMessages[room]) {
      this.unreadMessages[room][username] = 0;
    }

    if (type === 'general'){
      client.send(JSON.stringify({ event: 'unreadMessages', data: { room, count: this.getUnreadCount(room, username) } }));
      this.sendGeneralUnreadInfo();
    }

    if (type === 'private') {
      const sender = room.split('_')[1];
      const receiver = room.split('_')[2];
      const senderClient = Array.from(this.server.clients).find((c: any) => c['username'] === sender) as any;
      const receiverClient = Array.from(this.server.clients).find((c: any) => c['username'] === receiver) as any;
      if (senderClient) {
        senderClient.send(JSON.stringify({ event: 'unreadMessages', data: { room, count: this.getUnreadCount(room, username) } }));
      }
      if (receiverClient) {
        receiverClient.send(JSON.stringify({ event: 'unreadMessages', data: { room, count: this.getUnreadCount(room, username) } }));
      }
    } 
    console.log('>> handleMarkAsRead unreadMessages', this.unreadMessages);
  }

  private getUnreadCount(room: string, username: string): number {
    if (!this.unreadMessages[room] || !this.unreadMessages[room][username]) {
      return 0;
    }
    return this.unreadMessages[room][username];
  }

  private async updateUnreadCount(room: string, sender: string, receiver?: string) {

    if(sender === receiver) { // 如果發送者和接收者是同一個人，不計算未讀訊息數量
      return;
    }

    if (!this.unreadMessages[room]) {
      this.unreadMessages[room] = {};
    }

    if (receiver) {
      // 只更新接收者的未讀訊息數量
      if (!this.unreadMessages[room][receiver]) {
        this.unreadMessages[room][receiver] = 0;
      }
      this.unreadMessages[room][receiver]++;
      const receiveClient = Array.from(this.server.clients).find((c: any) => c['username'] === receiver) as any;
      const senderClient = Array.from(this.server.clients).find((c: any) => c['username'] === sender) as any;
      if (receiveClient) {
        receiveClient.send(JSON.stringify({ event: 'unreadMessages', data: { room, count: this.unreadMessages[room][receiver] } }));
      }
      if (senderClient) {
        senderClient.send(JSON.stringify({ event: 'unreadMessages', data: { room, count: this.unreadMessages[room][receiver] } }));
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
      // 更新發送者的未讀訊息數量
      this.unreadMessages[room][sender] = 0;
      this.sendGeneralUnreadInfo();
    }
  }

  private async updateOnlineUsers() {
    const onlineUsers = await this.userService.getOnlineUsers();
    this.server.clients.forEach((client: any) => {
      client.send(JSON.stringify({ event: 'onlineUsers', data: { users: onlineUsers } }));
    });
  }

  private sendGeneralUnreadInfo() {
    this.server.clients.forEach((client: any) => {
      client.send(JSON.stringify({ event: 'generalUnReadInfo', data: this.unreadMessages['general'] }));
    });
  }
}