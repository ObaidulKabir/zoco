export type PushMessage = {
  subscriptionEndpoint: string;
  title: string;
  body: string;
};

export interface PushPort {
  send(msg: PushMessage): Promise<void>;
}
