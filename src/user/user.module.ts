import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { NotificationModule } from 'src/notification/notification.module';

@Module({
  imports: [
    JwtModule.register({
      secret: 'your_jwt_secret', // 替換為你的 JWT 秘鑰
      signOptions: { expiresIn:  '365d' },
    }),
    NotificationModule
  ],
  controllers: [UserController],
  providers: [UserService, JwtAuthGuard],
  exports: [UserService],
})
export class UserModule {}
