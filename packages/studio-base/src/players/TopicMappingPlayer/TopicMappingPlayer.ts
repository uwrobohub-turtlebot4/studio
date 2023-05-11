// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Time } from "@foxglove/rostime";
import { ParameterValue } from "@foxglove/studio-base/../../studio/src";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import {
  AdvertiseOptions,
  Player,
  PlayerState,
  PublishPayload,
  SubscribePayload,
} from "@foxglove/studio-base/players/types";

export class TopicMappingPlayer implements Player {
  readonly #player: Player;

  public constructor(player: Player) {
    this.#player = player;
  }

  public setListener(listener: (playerState: PlayerState) => Promise<void>): void {
    this.#player.setListener(listener);
  }

  public close(): void {
    this.#player.close();
  }

  public setSubscriptions(subscriptions: SubscribePayload[]): void {
    this.#player.setSubscriptions(subscriptions);
  }

  public setPublishers(publishers: AdvertiseOptions[]): void {
    this.#player.setPublishers(publishers);
  }

  public setParameter(key: string, value: ParameterValue): void {
    this.#player.setParameter(key, value);
  }

  public publish(request: PublishPayload): void {
    this.#player.publish(request);
  }

  public async callService(service: string, request: unknown): Promise<unknown> {
    return await this.#player.callService(service, request);
  }

  public startPlayback?(): void {
    this.#player.startPlayback?.();
  }

  public pausePlayback?(): void {
    this.#player.pausePlayback?.();
  }

  public seekPlayback?(time: Time, backfillDuration?: Time | undefined): void {
    this.#player.seekPlayback?.(time, backfillDuration);
  }

  public playUntil?(time: Time): void {
    this.#player.playUntil?.(time);
  }

  public setPlaybackSpeed?(speedFraction: number): void {
    this.#player.setPlaybackSpeed?.(speedFraction);
  }

  public setGlobalVariables(globalVariables: GlobalVariables): void {
    this.#player.setGlobalVariables(globalVariables);
  }
}
