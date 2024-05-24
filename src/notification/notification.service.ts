import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class NotificationService {
  private notificationSubject = new Subject<{
    event: string;
    data: any;
  }>();

  notification$ = this.notificationSubject.asObservable();

  notify(message: { event: string; data: any }) {
    this.notificationSubject.next(message);
  }
}