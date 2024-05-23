import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

@Injectable()
export class NotificationService {
  private notificationSubject = new Subject<string>();

  notification$ = this.notificationSubject.asObservable();

  notify(message:string) {
    this.notificationSubject.next(message);
  }
}