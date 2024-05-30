import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JoinRoomDto, SendMessageDto, PrivateMessageDto, MarkAsReadDto } from './chat/websocket-docs';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { WsAdapter } from '@nestjs/platform-ws';
import * as bodyParser from 'body-parser';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api'); // 設置全局路徑前綴
  app.enableCors({
    // 可以換成自己的網址，或是設置為 * 來允許所有網址
    origin: [
      'https://jiahongl.github.io',
      'http://localhost:4200',
      'http://localhost:5173',
      'http://localhost:3000',
      'http://localhost:8080',
    ],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    allowedHeaders: 'Content-Type, Accept, Authorization',
  }); // 啟用跨域請求

  app.useWebSocketAdapter(new WsAdapter(app));

  const config = new DocumentBuilder()
    .setTitle('Chat App API')
    .setDescription('這是一個簡單的聊天室應用程式 API 文件，提供註冊、登入、取得使用者資訊、取得全部使用者，預設使用者名稱為 Joe，密碼為 abc，其他使用者 Joe, John, Jane, Jack, David, Linda，密碼一樣 abc，另外 websocket 使用方式請參閱 <a href="https://github.com/JiaHongL/chat-app-backend?tab=readme-ov-file#websocket-api-%E6%96%87%E4%BB%B6" target="_blank"> Github readme</a>。')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: false,
    // extraModels: [JoinRoomDto, SendMessageDto, PrivateMessageDto, MarkAsReadDto],
  });

  SwaggerModule.setup('api/docs', app, document, {
    customSiteTitle: 'Chat App API Docs',
    customCss: `
      .swagger-ui .topbar { display: none }
    `,
    customfavIcon: '/assets/favicon.ico',
    customJs: '/assets/custom.js',
  });

  app.useStaticAssets(join(__dirname, '..', 'public'));

  app.use(bodyParser.json({ limit: '500mb' }));
  app.use(bodyParser.urlencoded({ limit: '500mb', extended: true }));

  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
