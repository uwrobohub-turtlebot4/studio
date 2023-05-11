// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { transform } from "lodash";

import { Time } from "@foxglove/rostime";
import { MessageEvent, ParameterValue } from "@foxglove/studio";
import { GlobalVariables } from "@foxglove/studio-base/hooks/useGlobalVariables";
import {
  AdvertiseOptions,
  MessageBlock,
  Player,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
} from "@foxglove/studio-base/players/types";

type TopicMapping = Map<string, string>;
type MessageBlocks = readonly (undefined | MessageBlock)[];

function mapBlocks(blocks: MessageBlocks, mappings: TopicMapping): MessageBlocks {
  return blocks.map((block) => {
    return block
      ? {
          ...block,
          messagesByTopic: transform(
            block.messagesByTopic,
            (acc, value, key) => {
              const mappedTopic = mappings.get(key) ?? key;
              acc[mappedTopic] = mapMessages(value, mappings);
            },
            {} as Record<string, MessageEvent<unknown>[]>,
          ),
        }
      : undefined;
  });
}

function mapMessages(
  messages: readonly MessageEvent<unknown>[],
  mappings: TopicMapping,
): MessageEvent<unknown>[] {
  return messages.map((msg) => {
    return {
      ...msg,
      topic: mappings.get(msg.topic) ?? msg.topic,
    };
  });
}

function mapPublishedTopics(
  topics: Map<string, Set<string>>,
  mappings: TopicMapping,
): Map<string, Set<string>> {
  return new Map([...topics].map(([key, value]) => [mappings.get(key) ?? key, value]));
}

function mapSubscribedTopics(
  topics: Map<string, Set<string>>,
  mappings: TopicMapping,
): Map<string, Set<string>> {
  return new Map([...topics].map(([key, value]) => [mappings.get(key) ?? key, value]));
}

function mapTopics(topics: Topic[], mappings: TopicMapping): Topic[] {
  return topics.map((topic) => {
    return {
      ...topic,
      name: mappings.get(topic.name) ?? topic.name,
    };
  });
}

function mapSubscriptions(
  subcriptions: SubscribePayload[],
  mappings: TopicMapping,
): SubscribePayload[] {
  return subcriptions.map((sub) => {
    return {
      ...sub,
      topic: mappings.get(sub.topic) ?? sub.topic,
    };
  });
}

export class TopicMappingPlayer implements Player {
  #listener?: (arg0: PlayerState) => Promise<void>;
  readonly #player: Player;
  readonly #inverseMappings: Map<string, string> = new Map([
    ["/remapped_cam_front/image_rect_compressed", "/CAM_FRONT/image_rect_compressed"],
    ["/remapped_cam_front/camera_info", "/CAM_FRONT/camera_info"],
  ]);
  readonly #mappings: Map<string, string> = new Map([
    ["/CAM_FRONT/image_rect_compressed", "/remapped_cam_front/image_rect_compressed"],
    ["/CAM_FRONT/camera_info", "/remapped_cam_front/camera_info"],
  ]);

  public constructor(player: Player) {
    this.#player = player;
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

  async #onPlayerState(playerState: PlayerState) {
    const newState = { ...playerState };

    if (newState.activeData) {
      newState.activeData.topics = mapTopics(newState.activeData.topics, this.#mappings);
      newState.activeData.messages = mapMessages(newState.activeData.messages, this.#mappings);
      if (newState.activeData.publishedTopics) {
        newState.activeData.publishedTopics = mapPublishedTopics(
          newState.activeData.publishedTopics,
          this.#mappings,
        );
      }
      if (newState.activeData.subscribedTopics) {
        newState.activeData.subscribedTopics = mapSubscribedTopics(
          newState.activeData.subscribedTopics,
          this.#mappings,
        );
      }
    }

    if (newState.progress.messageCache?.blocks) {
      newState.progress.messageCache.blocks = mapBlocks(
        newState.progress.messageCache.blocks,
        this.#mappings,
      );
    }

    await this.#listener?.(newState);
  }
}
