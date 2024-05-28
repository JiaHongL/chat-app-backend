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
    example:'18fbc0882ab-eb70-5959',
    description: 'The id of the message',
  })
  id:string;

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

  @ApiProperty({
    example: '2021-01-01T12:00:00.000Z',
    description: 'The timestamp of the message',
  })
  date?: string;

  @ApiProperty({
    example: false,
    description: 'Whether the message is recalled',
  })
  isRecalled?: boolean;


  @ApiProperty({
    example: false,
    description: 'Whether the message is read',
  })
  isRead?: boolean;

  @ApiProperty({
    example: ['joe', 'jane', 'john'],
    description: 'The usernames of the recipients',
  })
  readBy?: string[];

}

export class PrivateMessageDto {

  @ApiProperty({
    example:'18fbc0882ab-eb70-5959',
    description: 'The id of the message',
  })
  id: string;

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

  @ApiProperty({
    example: '2021-01-01T12:00:00.000Z',
    description: 'The timestamp of the message',
  })
  date?: string;

  @ApiProperty({
    example: 'private_john_jane',
    description: 'The name of the private chat room',
  })
  room?: string;

  @ApiProperty({
    example: false,
    description: 'Whether the message is recalled',
  })
  isRecalled?: boolean;

  @ApiProperty({
    example: false,
    description: 'Whether the message is read',
  })
  isRead?: boolean;

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

  @ApiProperty({
    example: 'joe',
    description: 'The username of the reader',
  })
  reader: string;
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
