export const NOTIFICATION_CHANNELS = 'NOTIFICATION_CHANNELS';
export const ZNS_SERVICE = 'ZNS_SERVICE';

export interface NotificationChannelBridge {
  channel: string;
  send(payload: any): Promise<any>;
}
