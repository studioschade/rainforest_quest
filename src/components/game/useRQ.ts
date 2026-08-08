import { useSyncExternalStore } from 'react';
import { controller, GameController } from '@/game/controller';

/** Subscribe to controller state; returns the live controller singleton. */
export function useRQ(): GameController {
  useSyncExternalStore(controller.subscribe, controller.getVersion);
  return controller;
}
