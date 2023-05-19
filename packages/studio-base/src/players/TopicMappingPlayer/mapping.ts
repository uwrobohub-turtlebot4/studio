// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable as Im } from "immer";
import { transform, uniq } from "lodash";

import { MessageEvent } from "@foxglove/studio";
import { MessageBlock, SubscribePayload, Topic } from "@foxglove/studio-base/players/types";

export type TopicMapping = Map<string, string[]>;
export type MessageBlocks = readonly (undefined | MessageBlock)[];
export const EmptyMapping: Im<TopicMapping> = new Map();

export function mapBlocks(blocks: MessageBlocks, mapping: Im<TopicMapping>): MessageBlocks {
  if (mapping === EmptyMapping) {
    return blocks;
  }

  return blocks.map((block) => {
    return block
      ? {
          ...block,
          messagesByTopic: transform(
            block.messagesByTopic,
            (acc, messages, topic) => {
              acc[topic] = [...mapMessages(messages, mapping)];
            },
            {} as Record<string, MessageEvent<unknown>[]>,
          ),
        }
      : undefined;
  });
}

export function mapMessages(
  messages: readonly MessageEvent<unknown>[],
  mapping: Im<TopicMapping>,
): readonly MessageEvent<unknown>[] {
  if (mapping === EmptyMapping) {
    return messages;
  }

  return messages.flatMap((msg) => {
    const mappings = mapping.get(msg.topic);
    if (mappings) {
      return mappings.map((topic) => ({
        ...msg,
        topic,
      }));
    } else {
      return msg;
    }
  });
}

export function mapKeyedTopics(
  topics: Map<string, Set<string>>,
  mapping: Im<TopicMapping>,
): Map<string, Set<string>> {
  if (mapping === EmptyMapping) {
    return topics;
  }

  const mappedTopics = new Map<string, Set<string>>();
  for (const [key, values] of topics) {
    const mappedValues = [...values].flatMap((value) => mapping.get(value) ?? value);
    mappedTopics.set(key, new Set(mappedValues));
  }
  return mappedTopics;
}

export function mapTopics(topics: Topic[], mapping: Im<TopicMapping>): Topic[] {
  if (mapping === EmptyMapping) {
    return topics;
  }

  return topics.flatMap((topic) => {
    const mappings = mapping.get(topic.name);
    if (mappings) {
      return mappings.map((name) => ({
        ...topic,
        name,
      }));
    } else {
      return topic;
    }
  });
}

export function mapSubscriptions(
  subcriptions: SubscribePayload[],
  mapping: Im<TopicMapping>,
): SubscribePayload[] {
  if (mapping === EmptyMapping) {
    return subcriptions;
  }

  return subcriptions.flatMap((sub) => {
    const mappings = mapping.get(sub.topic);
    if (mappings) {
      return mappings.map((topic) => ({
        ...sub,
        topic,
      }));
    } else {
      return sub;
    }
  });
}

export function mergeMappings(maps: Im<TopicMapping[]>): TopicMapping {
  const merged: TopicMapping = new Map();
  for (const map of maps) {
    for (const [key, values] of map.entries()) {
      const mergedValues = uniq((merged.get(key) ?? []).concat(values));
      merged.set(key, mergedValues);
    }
  }
  return merged;
}

export function invertMapping(mapping: Im<TopicMapping>): TopicMapping {
  const inverted: TopicMapping = new Map();
  for (const [key, values] of mapping.entries()) {
    for (const value of values) {
      const newValues = inverted.get(value) ?? [];
      newValues.push(key);
      inverted.set(value, newValues);
    }
  }
  return inverted;
}
