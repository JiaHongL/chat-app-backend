import { Module, Global } from '@nestjs/common';
import { NotificationService } from './notification.service'; // 引入 NotificationService

@Global()
@Module({
  providers: [NotificationService],
  exports: [NotificationService] // 導出 NotificationService
})
export class NotificationModule {}