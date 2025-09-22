export interface IOperationPoller {
  pollOperation(operationName: string): Promise<any>;
}