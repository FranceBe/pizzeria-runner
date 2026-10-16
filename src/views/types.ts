import type { Dispatch, GameState, Service } from "../game/types";

export interface ScreenProps {
  state: GameState;
  dispatch: Dispatch;
}

/** For the service screen and its parts: only rendered while a service is running. */
export interface ServiceScreenProps extends ScreenProps {
  service: Service;
}
