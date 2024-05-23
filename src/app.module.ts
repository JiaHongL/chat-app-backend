import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UserModule } from './user/user.module';
import { ChatModule } from './chat/chat.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { NotificationService } from './notification/notification.service';
import { NotificationModule } from './notification/notification.module';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'), // 指向你的靜態文件目錄
      exclude: ['/api/docs*'], // 排除 /api/docs 路徑，以保留 API 文檔
    }),
    UserModule, 
    ChatModule
  ],
  controllers: [AppController],
  providers: [
    AppService,
    NotificationModule
  ],
})
export class AppModule {}
