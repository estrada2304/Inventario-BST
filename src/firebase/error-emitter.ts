type ErrorListener = (error: Error) => void;

class ErrorEmitter {
  private listeners: Map<string, ErrorListener[]> = new Map();

  on(event: string, listener: ErrorListener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)?.push(listener);
  }

  off(event: string, listener: ErrorListener) {
    const list = this.listeners.get(event);
    if (list) {
      this.listeners.set(event, list.filter(l => l !== listener));
    }
  }

  emit(event: string, error: Error) {
    const list = this.listeners.get(event);
    if (list) {
      list.forEach(listener => listener(error));
    }
  }
}

export const errorEmitter = new ErrorEmitter();
