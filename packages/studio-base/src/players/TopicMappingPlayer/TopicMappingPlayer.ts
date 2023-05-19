// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable as Im } from "immer";
import memoizeWeak from "memoize-weak";

import { Time } from "@foxglove/rostime";
import { ParameterValue, RegisterTopicMapperArgs } from "@foxglove/studio";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import {
  AdvertiseOptions,
  Player,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
} from "@foxglove/studio-base/players/types";

import {
  EmptyMapping,
  TopicMapping,
  invertMapping,
  mapBlocks,
  mapKeyedTopics,
  mapMessages,
  mapSubscriptions,
  mapTopics,
  mergeMappings,
} from "./mapping";

const memoMapTopics = memoizeWeak(mapTopics);
const memoMapKeyedTopics = memoizeWeak(mapKeyedTopics);
const memoMapBlocks = memoizeWeak(mapBlocks);

export class TopicMappingPlayer implements Player {
  readonly #player: Player;
  readonly #mappers: readonly RegisterTopicMapperArgs[];

  #inverseMappings: Im<TopicMapping> = EmptyMapping;
  #mapping: Im<TopicMapping> = EmptyMapping;
  #lastSeenTopics: undefined | Im<Topic[]> = undefined;

  #listener?: (arg0: PlayerState) => Promise<void>;

  public constructor(player: Player, mappers: readonly RegisterTopicMapperArgs[]) {
    this.#player = player;
    this.#mappers = mappers;
  }

  public setListener(listener: (playerState: PlayerState) => Promise<void>): void {
    this.#listener = listener;

    this.#player.setListener(async (state) => await this.#onPlayerState(state));
  }

  public close(): void {
    this.#player.close();
  }

  public setSubscriptions(subscriptions: SubscribePayload[]): void {
    const mappedSubscriptions = mapSubscriptions(subscriptions, this.#inverseMappings);
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

  #rebuildMappings(topics: Im<Topic[]>) {
    const mappings = this.#mappers.map((mapper) => mapper(topics));
    const anyMappings = mappings.some((map) => [...map.entries()].length > 0);

    // Combine mappings into one map and build the inverse map.
    this.#mapping = anyMappings ? mergeMappings(mappings) : EmptyMapping;
    this.#inverseMappings = anyMappings ? invertMapping(this.#mapping) : EmptyMapping;
  }

  async #onPlayerState(playerState: PlayerState) {
    if (this.#lastSeenTopics !== playerState.activeData?.topics) {
      this.#rebuildMappings(playerState.activeData?.topics ?? []);
      this.#lastSeenTopics = playerState.activeData?.topics;
    }

    if (this.#mapping === EmptyMapping) {
      await this.#listener?.(playerState);
      return;
    }

    const newState = { ...playerState };

    if (newState.activeData) {
      newState.activeData.topics = memoMapTopics(newState.activeData.topics, this.#mapping);
      newState.activeData.messages = mapMessages(newState.activeData.messages, this.#mapping);
      if (newState.activeData.publishedTopics) {
        newState.activeData.publishedTopics = memoMapKeyedTopics(
          newState.activeData.publishedTopics,
          this.#mapping,
        );
      }
      if (newState.activeData.subscribedTopics) {
        newState.activeData.subscribedTopics = memoMapKeyedTopics(
          newState.activeData.subscribedTopics,
          this.#mapping,
        );
      }
    }

    if (newState.progress.messageCache?.blocks) {
      newState.progress = {
        ...newState.progress,
        messageCache: {
          ...newState.progress.messageCache,
          blocks: memoMapBlocks(newState.progress.messageCache.blocks, this.#mapping),
        },
      };
    }

    await this.#listener?.(newState);
  }
}
