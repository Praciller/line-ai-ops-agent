import { messagingApi } from '@line/bot-sdk';

export interface LineReplyPort {
  reply(replyToken: string, text: string): Promise<void>;
}

export function createLineSdkReplyClient(channelAccessToken: string): LineReplyPort {
  const client = new messagingApi.MessagingApiClient({ channelAccessToken });

  return {
    async reply(replyToken: string, text: string): Promise<void> {
      await client.replyMessage({
        replyToken,
        messages: [{ type: 'text', text }],
      });
    },
  };
}
