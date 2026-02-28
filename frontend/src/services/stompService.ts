import { Client, IMessage } from '@stomp/stompjs';
import SockJS from 'sockjs-client';

export class StompService {
  private client: Client | null = null;

  connect(url: string, onConnect: () => void, onDisconnect: () => void): void {
    this.client = new Client({
      webSocketFactory: () => new SockJS(url) as WebSocket,
      onConnect: () => onConnect(),
      onDisconnect: () => onDisconnect(),
      onStompError: () => onDisconnect(),
    });
    this.client.activate();
  }

  subscribe(destination: string, callback: (message: IMessage) => void): void {
    this.client?.subscribe(destination, callback);
  }

  publish(destination: string, body: object): void {
    this.client?.publish({ destination, body: JSON.stringify(body) });
  }

  disconnect(): void {
    this.client?.deactivate();
    this.client = null;
  }
}

export const stompService = new StompService();
