import { EventEmitter } from 'node:events';

const eventBus = new EventEmitter();
eventBus.setMaxListeners(0);

export function publish(type, payload) {
  eventBus.emit('event', {
    type,
    payload,
    timestamp: new Date().toISOString(),
  });
}

export default eventBus;
