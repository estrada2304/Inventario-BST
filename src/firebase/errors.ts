export class FirestorePermissionError extends Error {
  path: string;
  operation: 'read' | 'write' | 'create' | 'update' | 'delete';
  requestResourceData?: any;

  constructor({
    path,
    operation,
    requestResourceData,
  }: {
    path: string;
    operation: 'read' | 'write' | 'create' | 'update' | 'delete';
    requestResourceData?: any;
  }) {
    super(`Firestore permission denied on path: ${path} for operation: ${operation}`);
    this.name = 'FirestorePermissionError';
    this.path = path;
    this.operation = operation;
    this.requestResourceData = requestResourceData;
  }
}
