import { ApiProperty } from '@nestjs/swagger';

export class JoinRoomDto {
  @ApiProperty({
    example: 'general',
    description: 'The name of the chat room to join',
  })
  room: string;
}

export class SendMessageDto {
  @ApiProperty({
    example: 'general',
    description: 'The name of the chat room to send the message to',
  })
  room: string;

  @ApiProperty({
    example: 'Hello everyone!',
    description: 'The content of the message',
  })
  message: string;

  @ApiProperty({
    example: 'john_doe',
    description: 'The username of the sender',
  })
  sender: string;
}

export class PrivateMessageDto {
  @ApiProperty({
    example: 'jane_doe',
    description: 'The username of the recipient',
  })
  to: string;

  @ApiProperty({
    example: 'Hi Jane!',
    description: 'The content of the private message',
  })
  message: string;

  @ApiProperty({
    example: 'john_doe',
    description: 'The username of the sender',
  })
  sender: string;
}

// 新增未讀訊息和已讀回執的 DTO
export class MarkAsReadDto {
  @ApiProperty({
    example: 'private_jane_john',
    description: 'The name of the room where messages are marked as read',
  })
  room: string;

  @ApiProperty({
    example: 'private',
    description: 'The type of the room (general or private)',
  })
  type: string;
}

export class ReadReceiptDto {
  @ApiProperty({
    example: 'private_jane_john',
    description: 'The name of the room where messages are read',
  })
  room: string;

  @ApiProperty({
    example: 'jane_doe',
    description: 'The username of the reader',
  })
  reader: string;

  @ApiProperty({
    example: 2,
    description: 'The number of unread messages',
  })
  unreadCount: number;
}
