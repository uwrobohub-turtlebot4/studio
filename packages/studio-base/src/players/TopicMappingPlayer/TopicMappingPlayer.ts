// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable as Im } from "immer";

import { Time } from "@foxglove/rostime";
import { ParameterValue } from "@foxglove/studio";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import {
  AdvertiseOptions,
  Player,
  PlayerState,
  PublishPayload,
  SubscribePayload,
} from "@foxglove/studio-base/players/types";

import {
  EmptyMapping,
  TopicMapping,
  invertMapping,
  mapBlocks,
  mapMessages,
  mapKeyedTopics,
  mapSubscriptions,
  mapTopics,
  mergeMappings,
} from "./mapping";

export class TopicMappingPlayer implements Player {
  readonly #player: Player;
  readonly #inverseMapping: Im<TopicMapping>;
  readonly #mapping: Im<TopicMapping>;

  #listener?: (arg0: PlayerState) => Promise<void>;

  public constructor(player: Player, mappings: Im<TopicMapping[]>) {
    this.#player = player;

    const anyMappings = mappings.some((map) => [...map.entries()].length > 0);

    // Combine mappings into one map and build the inverse map.
    this.#mapping = anyMappings ? mergeMappings(mappings) : EmptyMapping;
    this.#inverseMapping = anyMappings ? invertMapping(this.#mapping) : EmptyMapping;
  }

  public setListener(listener: (playerState: PlayerState) => Promise<void>): void {
    this.#listener = listener;

    this.#player.setListener(async (state) => await this.#onPlayerState(state));
  }

  public close(): void {
    this.#player.close();
  }

  public setSubscriptions(subscriptions: SubscribePayload[]): void {
    const mappedSubscriptions = mapSubscriptions(subscriptions, this.#inverseMapping);
    this.#player.setSubscriptions(mappedSubscriptions);
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

  async #onPlayerState(playerState: PlayerState) {
    if (this.#mapping === EmptyMapping) {
      await this.#listener?.(playerState);
      return;
    }

    const newState = { ...playerState };

    if (newState.activeData) {
      newState.activeData.topics = mapTopics(newState.activeData.topics, this.#mapping);
      newState.activeData.messages = mapMessages(newState.activeData.messages, this.#mapping);
      if (newState.activeData.publishedTopics) {
        newState.activeData.publishedTopics = mapKeyedTopics(
          newState.activeData.publishedTopics,
          this.#mapping,
        );
      }
      if (newState.activeData.subscribedTopics) {
        newState.activeData.subscribedTopics = mapKeyedTopics(
          newState.activeData.subscribedTopics,
          this.#mapping,
        );
      }
    }

    if (newState.progress.messageCache?.blocks) {
      newState.progress.messageCache.blocks = mapBlocks(
        newState.progress.messageCache.blocks,
        this.#mapping,
      );
    }

    await this.#listener?.(newState);
  }
}
