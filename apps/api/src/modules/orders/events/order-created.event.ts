export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly vendorId: string,
    public readonly orderData: Record<string, unknown>,
  ) {}
}
