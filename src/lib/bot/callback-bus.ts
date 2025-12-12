import { EventEmitter } from "node:events";
import { CallbackDataType } from "./constants";

type CallbackPayload<T> = {
  data: T;
};

const DEFAULT_TIMEOUT = 60_000; // 1 minute

const emitter = new EventEmitter();
emitter.setMaxListeners(0);

//#region LOGIN ATTEMPT EVENT
function loginAttemptEvent(id: string) {
  return `${CallbackDataType.LoginAttempt}:${id}`;
}

export function emitLoginAttempt<T>(
  id: string,
  payload: CallbackPayload<T>,
): void {
  emitter.emit(loginAttemptEvent(id), payload);
}

export function waitForLoginAttempt<T>(
  id: string,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<CallbackPayload<T>> {
  return new Promise((resolve, reject) => {
    const eventName = loginAttemptEvent(id);

    const onPayload = (payload: CallbackPayload<T>) => {
      clearTimeout(timer);
      emitter.removeListener(eventName, onPayload);
      resolve(payload);
    };

    const timer = setTimeout(() => {
      emitter.removeListener(eventName, onPayload);
      reject(new Error("login attempt callback timed out"));
    }, timeoutMs);

    emitter.once(eventName, onPayload);
  });
}
//#endregion

//#region VERIFY ATTEMPT EVENT
function verifyAttemptEvent(id: string) {
  return `${CallbackDataType.VerifyAttempt}:${id}`;
}

export function emitVerifyAttempt<T>(
  id: string,
  payload: CallbackPayload<T>,
): void {
  emitter.emit(verifyAttemptEvent(id), payload);
}

export function waitForVerifyAttempt<T>(
  id: string,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<CallbackPayload<T>> {
  return new Promise((resolve, reject) => {
    const eventName = verifyAttemptEvent(id);

    const onPayload = (payload: CallbackPayload<T>) => {
      clearTimeout(timer);
      emitter.removeListener(eventName, onPayload);
      resolve(payload);
    };

    const timer = setTimeout(() => {
      emitter.removeListener(eventName, onPayload);
      reject(new Error("verify attempt callback timed out"));
    }, timeoutMs);

    emitter.once(eventName, onPayload);
  });
}
//#endregion

//#region METHOD ATTEMPT EVENT
function methodAttemptEvent(id: string) {
  return `${CallbackDataType.MethodAttempt}:${id}`;
}

export function emitMethodAttempt<T>(
  id: string,
  payload: CallbackPayload<T>,
): void {
  emitter.emit(methodAttemptEvent(id), payload);
}

export function waitForMethodAttempt<T>(
  id: string,
  timeoutMs = DEFAULT_TIMEOUT,
): Promise<CallbackPayload<T>> {
  return new Promise((resolve, reject) => {
    const eventName = methodAttemptEvent(id);

    const onPayload = (payload: CallbackPayload<T>) => {
      clearTimeout(timer);
      emitter.removeListener(eventName, onPayload);
      resolve(payload);
    };

    const timer = setTimeout(() => {
      emitter.removeListener(eventName, onPayload);
      reject(new Error("method attempt callback timed out"));
    }, timeoutMs);

    emitter.once(eventName, onPayload);
  });
}
//#endregion
