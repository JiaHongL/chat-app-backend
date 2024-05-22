import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { JoinRoomDto, SendMessageDto, PrivateMessageDto, MarkAsReadDto } from './chat/websocket-docs';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { WsAdapter } from '@nestjs/platform-ws';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  app.useWebSocketAdapter(new WsAdapter(app));

  const config = new DocumentBuilder()
    .setTitle('Chat App API')
    .setDescription('The Chat App API description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    ignoreGlobalPrefix: true,
    extraModels: [JoinRoomDto, SendMessageDto, PrivateMessageDto, MarkAsReadDto],
  });

  SwaggerModule.setup('api', app, document, {
    customSiteTitle: 'Chat App API Docs',
    customCss: `
      .swagger-ui .topbar { display: none }
    `,
    customfavIcon: '/assets/favicon.ico',
    customJs: '/assets/custom.js',
  });

  app.useStaticAssets(join(__dirname, '..', 'public'));

  await app.listen(3000);
  console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
