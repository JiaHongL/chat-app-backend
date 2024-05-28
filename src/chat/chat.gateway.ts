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
      setTimeout(() => {
        client.send(JSON.stringify({ event: 'unreadMessages', data: { room: 'general', count: this.getUnreadCount('general', client['username']) } }));
      });

      // 發送大廳聊天室的每個人的未讀消息資訊
      setTimeout(() => {
        client.send(JSON.stringify({ event: 'generalUnReadInfo', data: this.unreadMessages['general']||{}}));
      })

      const copyMessageHistory = JSON.parse(JSON.stringify(this.messageHistory)); 

      // 發送私人訊息歷史和未讀數量
      Object.keys(copyMessageHistory).forEach(room => {
        // 發送私人聊天歷史 ( 自己房間 (john) 和 對方房間 (jane) ) Ex: private_john_jane, private_jane_john
        if (room.startsWith('private_') && room.includes(user.username)) {
          setTimeout(() => {
            const messages = copyMessageHistory[room].map((msg: any) => {
              if (msg.isRecalled) {
                return {
                  id: msg.id,
                  room: msg.room,
                  sender: msg.sender,
                  to: msg.to,
                  isRecalled: true
                }
              }
              return msg;
            });
            client.send(JSON.stringify({ event: 'messageHistory', data: { room, messages } }));
          });
        }
        // 發送未讀消息數量
        if (room.startsWith('private_') && room.endsWith('_' + user.username)) {
          const receiver = user.username;
          client.send(JSON.stringify({ event: 'unreadMessages', data: { room, count: this.getUnreadCount(room, receiver) } }));
        }
      });

      // 更新在線用戶列表
      setTimeout(() => {
        this.updateOnlineUsers();
      });

      // 發送大廳聊天歷史
      setTimeout(() => {
        const messages = copyMessageHistory.general.map((msg: any) => {
          if (msg.isRecalled) {
            return {
              id: msg.id,
              room: msg.room,
              isRecalled: true,
              sender: msg.sender
            }
          }
          return msg;
        });
        client.send(JSON.stringify({ event: 'messageHistory', data: { room: 'general', messages } }));
        setTimeout(() => {
          // 通知客戶端連接成功
          client.send(JSON.stringify({ event: 'initializationComplete', data: { message : 'Relevant initialization data has been sent' } }));  
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
    data.id = this.generateGUID();
    data.isRecalled = false;
    data.readBy = [data.sender];
    this.server.clients.forEach((c: any) => {
      if (c['room'] === data.room) {
        c.send(JSON.stringify({ event: 'message', data }));
      } else if (data.room === 'general') {
        c.send(JSON.stringify({ event: 'message', data }));
      }
    });
    this.messageHistory[data.room] = this.messageHistory[data.room] || [];
    this.messageHistory[data.room].push(data);
    this.updateGeneralUnreadCount('message', {
      sender: data.sender,
    });
  }

  @SubscribeMessage('privateMessage')
  handlePrivateMessage(@MessageBody() data: PrivateMessageDto, @ConnectedSocket() client: any) {
    console.log('=================================================================================');
    console.log('>> handlePrivateMessage data', data);
    data.date = new Date().toISOString();
    data.id = this.generateGUID();
    data.isRead = false;
    data.isRecalled = false;
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

    if (type === 'general'){
      this.messageHistory.general.forEach((message: any) => {
        message.readBy.includes(data.reader) ? null : message.readBy.push(data.reader);
      });
      this.updateGeneralUnreadCount('markAsRead',{
        reader: data.reader
      });
    }

    if (type === 'private') {
      const sender = room.split('_')[1];
      const receiver = room.split('_')[2];

      const senderClient = Array.from(this.server.clients).find((c: any) => c['username'] === sender) as any;
      const receiverClient = Array.from(this.server.clients).find((c: any) => c['username'] === receiver) as any;

      const _room = `private_${sender}_${receiver}`;
      const _reverseRoom = `private_${receiver}_${sender}`;

      this.messageHistory[_room] = this.messageHistory[_room].map((message: any) => {
        return {
          ...message,
          isRead: true
        };
      });

      this.messageHistory[_reverseRoom] = this.messageHistory[_reverseRoom].map((message: any) => {
        return {
          ...message,
          isRead: true
        };
      });

      if (senderClient) {
        senderClient.send(JSON.stringify({ event: 'privateMessageRead', data: { room:`private_${sender}_${receiver}`}}));
        senderClient.send(JSON.stringify({ event: 'privateMessageRead', data: { room:`private_${receiver}_${sender}`}}));
      }
      if (receiverClient) {
        receiverClient.send(JSON.stringify({ event: 'privateMessageRead', data: { room:`private_${sender}_${receiver}`}}));
        receiverClient.send(JSON.stringify({ event: 'privateMessageRead', data: { room:`private_${receiver}_${sender}`}}));
      }

      this.updateUnreadCount(_room, sender, receiver);

    } 

  }

  @SubscribeMessage('recallMessage')
  handelRecallMessage(@MessageBody()data, @ConnectedSocket() client: any) {
    console.log('=================================================================================');
    console.log('>> handelRecallMessage data', data);
    const messageId = data.id;
    const room = data.room;
    if(room === 'general') { // 如果是大廳訊息
      this.messageHistory[room] = this.messageHistory[room].map((message: any) => {
        if (message.id === messageId) {
          message.isRecalled = true;
        }
        return message;
      });
      const sender = this.messageHistory[room].find((message: any) => message.id === messageId).sender;
      this.server.clients.forEach((c: any) => {
        c.send(JSON.stringify({ event: 'messageRecalled', data: {  sender,room, id:messageId, isRecalled:true } }));
      });
      this.updateGeneralUnreadCount('recall', {
        sender
      });
    }else{ // 如果是私人訊息
      const sender = this.messageHistory[room].find((message: any) => message.id === messageId).sender;
      const to = this.messageHistory[room].find((message: any) => message.id === messageId).to;
      const _room = `private_${sender}_${to}`;
      const _reverseRoom = `private_${to}_${sender}`;

      this.messageHistory[_room] = this.messageHistory[_room].map((message: any) => {
        if (message.id === messageId) {
          message.isRecalled = true;
        }
        return message;
      });

      this.messageHistory[_reverseRoom] = this.messageHistory[_reverseRoom].map((message: any) => {
        if (message.id === messageId) {
          message.isRecalled = true;
        }
        return message;
      });

      // 如果發送者和接收者是同一個人，則只發送一次收回訊息事件
      if (sender=== to) {
        client.send(JSON.stringify({ event: 'messageRecalled', data: { sender, to, room, id:messageId, isRecalled:true  } }));
        return;
      }

      this.server.clients.forEach((c: any) => {
        if (c['username'] === sender || c['username'] === to) {
          c.send(JSON.stringify({ event: 'messageRecalled', data: { sender, to, room:_room, id:messageId, isRecalled:true  } }));
          c.send(JSON.stringify({ event: 'messageRecalled', data: { sender, to, room: _reverseRoom, id:messageId, isRecalled:true  } }));
        }
      });

      const isRead = this.messageHistory[_room].find((message: any) => message.id === messageId).isRead;
      if(!isRead){
        this.updateUnreadCount(`private_${sender}_${to}`, sender, to, 'recallPrivateMessage', messageId);
      }
    }
  }

  @SubscribeMessage('undoRecallMessage')
  handleUndoRecallMessage(@MessageBody()data, @ConnectedSocket() client: any) {
    console.log('=================================================================================');
    console.log('>> handleUndoRecallMessage data', data);

    const messageId = data.id;
    const room = data.room;
    const sender = data.sender;
    if(room === 'general') {
      this.messageHistory[room] = this.messageHistory[room].map((message: any) => {
        if (message.id === messageId) {
          message.isRecalled = false;
        }
        return message;
      });
      const message = this.messageHistory[room].find((message: any) => message.id === messageId);
      this.server.clients.forEach((c: any) => {
        c.send(JSON.stringify({ event: 'messageUndoRecalled', data: message, isRecalled:false  }));
      });
      this.updateGeneralUnreadCount('undoRecall', {
        sender
      });
    }else {
      const sender = room.split('_')[1];
      const receiver = room.split('_')[2];
      const reverseRoom = `private_${receiver}_${sender}`;

      this.messageHistory[room] = this.messageHistory[room].map((message: any) => {
        if (message.id === messageId) {
          message.isRecalled = false;
        }
        return message;
      });

      this.messageHistory[reverseRoom] = this.messageHistory[reverseRoom].map((message: any) => {
        if (message.id === messageId) {
          message.isRecalled = false;
        }
        return message;
      });

      const message = this.messageHistory[room].find((message: any) => message.id === messageId);
      const reverseMessage = this.messageHistory[reverseRoom].find((message: any) => message.id === messageId);

      if (sender === receiver) {
        client.send(JSON.stringify({ event: 'messageUndoRecalled', data: message, isRecalled:false }));
        console.log('undoRecallPrivateMessage 自己傳給自己的訊息不計算未讀訊息數量');
        return;
      }

      this.server.clients.forEach((c: any) => {
        if (c['username'] === sender || c['username'] === receiver) {
          c.send(JSON.stringify({ event: 'messageUndoRecalled', data: message, isRecalled:false }));
          c.send(JSON.stringify({ event: 'messageUndoRecalled', data: reverseMessage, isRecalled:false }));
        }
      });
      
      if(!message.isRead){
        this.updateUnreadCount(`private_${message.sender}_${message.to}`, message.sender, message.to, 'undoRecallPrivateMessage', messageId);
      }

    }

  }

  private async updateUnreadCount(room: string, sender: string, receiver: string, action: 'recallPrivateMessage' | 'undoRecallPrivateMessage' | null = null, messageId ='') {

    if(sender === receiver) { // 如果發送者和接收者是同一個人，不計算未讀訊息數量
      return;
    }

    if (!this.unreadMessages[room]) {
      this.unreadMessages[room] = {};
    }

    if (action === 'recallPrivateMessage') { // 如果是撤回訊息，則減少未讀訊息數量
      const message = this.messageHistory[room].find((message: any) => message.id === messageId) as PrivateMessageDto;
      const _room = `private_${message.sender}_${message.to}`;
      this.unreadMessages[_room][message.to]--;
      const receiveClient = Array.from(this.server.clients).find((c: any) => c['username'] === message.to) as any;
      if (receiveClient) {
        receiveClient.send(JSON.stringify({ event: 'unreadMessages', data: { room, count: this.unreadMessages[room][receiver] } }));
      }
      return;
    }

    if(action === 'undoRecallPrivateMessage') { // 如果是撤回訊息，則減少未讀訊息數量
      const message = this.messageHistory[room].find((message: any) => message.id === messageId) as PrivateMessageDto;
      const _room = `private_${message.sender}_${message.to}`;
      this.unreadMessages[_room][message.to]++;
      const receiveClient = Array.from(this.server.clients).find((c: any) => c['username'] === message.to) as any;
      if (receiveClient) {
        receiveClient.send(JSON.stringify({ event: 'unreadMessages', data: { room, count: this.unreadMessages[room][receiver] } }));
      }
      return;
    }

    // 如果用戶不在未讀消息列表中，則創建一個新的
    if (!this.unreadMessages[room][receiver]) {
      this.unreadMessages[room][receiver] = 0;
    }
  
    const roomData = this.messageHistory[room];
    let unreadCount = 0;
    roomData.forEach((message: any) => {
      if (!message.isRead && !message.isRecalled) {
        unreadCount++;
      }
    });
    this.unreadMessages[room][receiver] = unreadCount;
    const receiveClient = Array.from(this.server.clients).find((c: any) => c['username'] === receiver) as any;
    const senderClient = Array.from(this.server.clients).find((c: any) => c['username'] === sender) as any;
    if (receiveClient) {
      receiveClient.send(JSON.stringify({ event: 'unreadMessages', data: { room, count: this.unreadMessages[room][receiver] } }));
    }
    if (senderClient) {
      senderClient.send(JSON.stringify({ event: 'unreadMessages', data: { room, count: this.unreadMessages[room][receiver] } }));
    }
  }

  private getUnreadCount(room: string, username: string): number {
    if (!this.unreadMessages[room] || !this.unreadMessages[room][username]) {
      return 0;
    }
    return this.unreadMessages[room][username];
  }

  private async updateGeneralUnreadCount(
    action: 'message' | 'markAsRead' | 'recall' | 'undoRecall', {
      sender = '',
      reader = ''
    }
  ){
    if (!this.unreadMessages['general']) {
      this.unreadMessages['general'] = {};
    }

    const users = await this.userService.getAllUsers();
    
    users?.forEach((user: any) => {
      // 如果用戶不在未讀消息列表中，則創建一個新的
      if (
        !this.unreadMessages['general'][user.username]
      ) {
        this.unreadMessages['general'][user.username] = 0;
      }

      // 送訊息的人，直接已讀 
      if (
        action === 'message' &&
        user.username === sender
      ) {
        this.unreadMessages['general'][user.username] = 0;
        return;
      }

      // 已讀消息
      if (
        action === 'markAsRead' &&
        user.username === reader
      ) {
        this.unreadMessages['general'][user.username] = 0;
        return;
      }

      let unreadCount = 0;

      this.messageHistory.general.forEach((message: any) => {
        // 不在已讀列表中且未被撤回的訊息
        if (!message.readBy.includes(user.username) && !message.isRecalled) {
          unreadCount++;
        }
      });
      this.unreadMessages['general'][user.username] = unreadCount;
    });

    this.sendMessagesReadByUpdated();

    this.server.clients.forEach((client: any) => {
      const username = client['username'];
      client.send(JSON.stringify({ event: 'unreadMessages', data: { room: 'general', count: this.getUnreadCount('general', username) } }));
    });
  }

  private sendMessagesReadByUpdated() {
    this.server.clients.forEach((client: any) => {
      client.send(JSON.stringify({ 
        event: 'messagesReadByUpdated', 
        data: this.messageHistory.general.map((msg: any) => {
          return {
            id: msg.id,
            readBy: msg.readBy
          }
        })
      }));
    });
  }

  private async updateOnlineUsers() {
    const onlineUsers = await this.userService.getOnlineUsers();
    this.server.clients.forEach((client: any) => {
      client.send(JSON.stringify({ event: 'onlineUsers', data: { users: onlineUsers } }));
    });
  }

  private generateGUID() {
    const s4 = () => Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
    const timestamp = new Date().getTime();
    const timeString = timestamp.toString(16);
    return timeString + '-' + s4() + '-' + s4();
  }

}