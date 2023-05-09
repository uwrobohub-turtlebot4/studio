// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { difference } from "lodash";
import memoizeWeak from "memoize-weak";
import { DeepReadonly } from "ts-essentials";

import { filterMap } from "@foxglove/den/collection";
import { compare, toSec } from "@foxglove/rostime";
import {
  AppSettingValue,
  MessageEvent,
  ParameterValue,
  RegisterMessageConverterArgs,
  RenderState,
  Subscription,
  Topic,
} from "@foxglove/studio";
import {
  EMPTY_GLOBAL_VARIABLES,
  GlobalVariables,
} from "@foxglove/studio-base/hooks/useGlobalVariables";
import { PlayerState, Topic as PlayerTopic } from "@foxglove/studio-base/players/types";
import { HoverValue } from "@foxglove/studio-base/types/hoverValue";

const EmptyParameters = new Map<string, ParameterValue>();

type BuilderRenderStateInput = {
  appSettings: Map<string, AppSettingValue> | undefined;
  colorScheme: RenderState["colorScheme"] | undefined;
  currentFrame: MessageEvent<unknown>[] | undefined;
  globalVariables: GlobalVariables;
  hoverValue: HoverValue | undefined;
  messageConverters?: readonly RegisterMessageConverterArgs<unknown>[];
  playerState: PlayerState | undefined;
  sharedPanelState: Record<string, unknown> | undefined;
  sortedTopics: readonly PlayerTopic[];
  subscriptions: Subscription[];
  watchedFields: Set<string>;
};

type BuildRenderStateFn = (input: BuilderRenderStateInput) => Readonly<RenderState> | undefined;

// Branded string to ensure that users go through the `converterKey` function to compute a lookup key
type Brand<K, T> = K & { __brand: T };
type ConverterKey = Brand<string, "ConverterKey">;

// Create a string lookup key from a message event
//
// The string key uses a newline delimeter to avoid producting the same key for topic/schema name
// values that might concatenate to the same string. i.e. "topic" "schema" and "topics" "chema".
function converterKey(topic: string, schema: string): ConverterKey {
  return (topic + "\n" + schema) as ConverterKey;
}

/**
 * Convert message into convertedMessages using the keyed converters. Modifies
 * convertedMessages in place for efficiency.
 */
function convertMessage(
  messageEvent: DeepReadonly<MessageEvent<unknown>>,
  converters: DeepReadonly<Map<ConverterKey, RegisterMessageConverterArgs<unknown>[]>>,
  convertedMessages: MessageEvent<unknown>[],
) {
  const key = converterKey(messageEvent.topic, messageEvent.schemaName);
  const matchedConverters = converters.get(key);
  for (const converter of matchedConverters ?? []) {
    const convertedMessage = converter.converter(messageEvent.message);
    convertedMessages.push({
      topic: messageEvent.topic,
      schemaName: converter.toSchemaName,
      receiveTime: messageEvent.receiveTime,
      message: convertedMessage,
      originalMessageEvent: messageEvent,
      sizeInBytes: messageEvent.sizeInBytes,
    });
  }
}

type TopicSchemaConverterMap = Map<ConverterKey, RegisterMessageConverterArgs<unknown>[]>;

/**
 * Returns a new map consisting of all items in b not present in a.
 */
function mapDifference<K, V>(a: undefined | Map<K, V[]>, b: Map<K, V[]>): Map<K, V[]> {
  const result = new Map<K, V[]>();
  for (const [key, value] of b.entries()) {
    const newValues = difference(value, a?.get(key) ?? []);
    if (newValues.length > 0) {
      result.set(key, newValues);
    }
  }
  return result;
}

const memoMapDifference = memoizeWeak(mapDifference);

type TopicSchemaConversions = {
  // Topics which we are subscribed without a conversion, these are topics we
  // want to receive the original message.
  unconvertedSubscriptionTopics: Set<string>;

  // When a subscription with a convertTo exists, we use this map to lookup a
  // converter which can produce the desired output message schema. The keys for
  // the map are `topic + input schema`.
  //
  // This allows the runtime message event handler logic which builds
  // currentFrame and allFrames to lookup whether the incoming message event has
  // converters to run by looking up the topic + schema of the message event in
  // this map.
  topicSchemaConverters: TopicSchemaConverterMap;
};

/**
 * Builds a set of topics we can render without conversion and a map of
 * converterKey -> converter arguments we use to produce converted messages.
 *
 * This will be memoized for performance so the inputs should be stable.
 */
function collateTopicSchemaConversions(
  subscriptions: readonly Subscription[],
  sortedTopics: readonly PlayerTopic[],
  messageConverters: undefined | readonly RegisterMessageConverterArgs<unknown>[],
): TopicSchemaConversions {
  const topicSchemaConverters = new Map<ConverterKey, RegisterMessageConverterArgs<unknown>[]>();
  const unconvertedSubscriptionTopics: Set<string> = new Set();

  // Bin the subscriptions into two sets: those which want a conversion and those that do not.
  //
  // For the subscriptions that want a conversion, if the topic schemaName matches the requested
  // convertTo, then we don't need to do a conversion.
  for (const subscription of subscriptions) {
    if (!subscription.convertTo) {
      unconvertedSubscriptionTopics.add(subscription.topic);
      continue;
    }

    // If the convertTo is the same as the original schema for the topic then we don't need to
    // perform a conversion.
    const noConversion = sortedTopics.find(
      (topic) => topic.name === subscription.topic && topic.schemaName === subscription.convertTo,
    );
    if (noConversion) {
      unconvertedSubscriptionTopics.add(noConversion.name);
      continue;
    }

    // Since we don't have an existing topic with out destination schema we need to find
    // a converter that will convert from the topic to the desired schema
    const subscriberTopic = sortedTopics.find((topic) => topic.name === subscription.topic);
    if (!subscriberTopic) {
      continue;
    }

    const key = converterKey(subscription.topic, subscriberTopic.schemaName ?? "<no-schema>");
    let existingConverters = topicSchemaConverters.get(key);

    // We've already stored a converter for this topic to convertTo
    const haveConverter = existingConverters?.find(
      (conv) => conv.toSchemaName === subscription.convertTo,
    );
    if (haveConverter) {
      continue;
    }

    // Find a converter that can go from the original topic schema to the target schema
    // Note: We only support one converter per unique from/to pair so this _find_ only needs to
    //       find one converter rather than multiple converters.
    const converter = messageConverters?.find(
      (conv) =>
        conv.fromSchemaName === subscriberTopic.schemaName &&
        conv.toSchemaName === subscription.convertTo,
    );

    if (converter) {
      existingConverters ??= [];
      existingConverters.push(converter);
      topicSchemaConverters.set(key, existingConverters);
    }
  }

  return { unconvertedSubscriptionTopics, topicSchemaConverters };
}

const memoCollateTopicSchemaConversions = memoizeWeak(collateTopicSchemaConversions);

/**
 * initRenderStateBuilder creates a function that transforms render state input into a new
 * RenderState
 *
 * This function tracks previous input to determine what parts of the existing render state to
 * update or whether there are any updates
 *
 * @returns a function that accepts render state input and returns a new RenderState to render or
 * undefined if there's no update for rendering
 */
function initRenderStateBuilder(): BuildRenderStateFn {
  let prevVariables: GlobalVariables = EMPTY_GLOBAL_VARIABLES;
  let prevBlocks: unknown;
  let prevSeekTime: number | undefined;
  let prevSubscriptions: BuilderRenderStateInput["subscriptions"];
  let prevSortedTopics: BuilderRenderStateInput["sortedTopics"] | undefined;
  let prevMessageConverters: BuilderRenderStateInput["messageConverters"] | undefined;
  let prevSharedPanelState: BuilderRenderStateInput["sharedPanelState"];
  let prevCurrentFrame: RenderState["currentFrame"];
  let prevCollatedConversions: undefined | TopicSchemaConversions;

  const prevRenderState: RenderState = {};

  return function buildRenderState(input: BuilderRenderStateInput) {
    const {
      appSettings,
      colorScheme,
      currentFrame,
      globalVariables,
      hoverValue,
      messageConverters,
      playerState,
      sharedPanelState,
      sortedTopics,
      subscriptions,
      watchedFields,
    } = input;

    // Should render indicates whether any fields of render state are updated
    let shouldRender = false;

    // Hoisted active data to shorten some of the code below that repeatedly uses active data
    const activeData = playerState?.activeData;

    // The render state starts with the previous render state and changes are applied as detected
    const renderState: RenderState = prevRenderState;

    // If the player has loaded all the blocks, the blocks reference won't change so our message
    // pipeline handler for allFrames won't create a new set of all frames for the newly
    // subscribed topic. To ensure a new set of allFrames with the newly subscribed topic is
    // created, we unset the blocks ref which will force re-creating allFrames.
    if (subscriptions !== prevSubscriptions) {
      prevBlocks = undefined;
    }

    const collatedConversions = memoCollateTopicSchemaConversions(
      subscriptions,
      sortedTopics,
      messageConverters,
    );
    const { unconvertedSubscriptionTopics, topicSchemaConverters } = collatedConversions;

    const newConverters = memoMapDifference(
      prevCollatedConversions?.topicSchemaConverters,
      topicSchemaConverters,
    );

    if (watchedFields.has("didSeek")) {
      const didSeek = prevSeekTime !== activeData?.lastSeekTime;
      if (didSeek !== renderState.didSeek) {
        renderState.didSeek = didSeek;
        shouldRender = true;
      }
      prevSeekTime = activeData?.lastSeekTime;
    }

    if (watchedFields.has("parameters")) {
      const parameters = activeData?.parameters ?? EmptyParameters;
      if (parameters !== renderState.parameters) {
        shouldRender = true;
        renderState.parameters = parameters;
      }
    }

    if (watchedFields.has("sharedPanelState")) {
      if (sharedPanelState !== prevSharedPanelState) {
        shouldRender = true;
        prevSharedPanelState = sharedPanelState;
        renderState.sharedPanelState = sharedPanelState;
      }
    }

    if (watchedFields.has("variables")) {
      if (globalVariables !== prevVariables) {
        shouldRender = true;
        prevVariables = globalVariables;
        renderState.variables = new Map(Object.entries(globalVariables));
      }
    }

    if (watchedFields.has("topics")) {
      if (sortedTopics !== prevSortedTopics || prevMessageConverters !== messageConverters) {
        shouldRender = true;

        const topics = sortedTopics.map<Topic>((topic) => {
          const newTopic: Topic = {
            name: topic.name,
            datatype: topic.schemaName ?? "",
            schemaName: topic.schemaName ?? "",
          };

          if (messageConverters) {
            const convertibleTo: string[] = [];

            // find any converters that can convert _from_ the schema name of the topic
            // the _to_ names of the converter become additional schema names for the topic entry
            for (const converter of messageConverters) {
              if (converter.fromSchemaName === topic.schemaName) {
                if (!convertibleTo.includes(converter.toSchemaName)) {
                  convertibleTo.push(converter.toSchemaName);
                }
              }
            }

            if (convertibleTo.length > 0) {
              newTopic.convertibleTo = convertibleTo;
            }
          }

          return newTopic;
        });

        renderState.topics = topics;
        prevSortedTopics = sortedTopics;
      }
    }

    if (watchedFields.has("currentFrame")) {
      if (currentFrame) {
        // If we have a new frame, emit that frame and process all messages on
        // that frame.
        const postProcessedFrame: MessageEvent<unknown>[] = [];
        // Only process unconverted messages on currentFrame.
        for (const messageEvent of currentFrame) {
          if (unconvertedSubscriptionTopics.has(messageEvent.topic)) {
            postProcessedFrame.push(messageEvent);
          }
          convertMessage(messageEvent, topicSchemaConverters, postProcessedFrame);
        }
        renderState.currentFrame = postProcessedFrame;
        shouldRender = true;
      } else if (prevCollatedConversions !== collatedConversions) {
        // If we don't have a new frame but our conversions have changed, run
        // only the new conversions on the previous frame.
        const postProcessedFrame: MessageEvent<unknown>[] = [];
        for (const messageEvent of prevCurrentFrame ?? []) {
          convertMessage(messageEvent, newConverters, postProcessedFrame);
          if (postProcessedFrame.length > 0) {
            renderState.currentFrame = postProcessedFrame;
            shouldRender = true;
          }
        }
      } else if (prevCurrentFrame !== currentFrame) {
        // Otherwise if we're replacing a non-empty frame with an empty frame,
        // include the empty frame in the new render state.
        renderState.currentFrame = currentFrame;
        shouldRender = true;
      }

      prevCurrentFrame = currentFrame;
    }

    if (watchedFields.has("allFrames")) {
      // see comment for prevBlocksRef on why extended message store updates are gated this way
      const newBlocks = playerState?.progress.messageCache?.blocks;
      if (newBlocks && prevBlocks !== newBlocks) {
        shouldRender = true;
        const frames: MessageEvent<unknown>[] = (renderState.allFrames = []);
        // only populate allFrames with topics that the panel wants to preload
        const topicsToPreloadForPanel = Array.from(
          new Set<string>(
            filterMap(subscriptions, (sub) => (sub.preload === true ? sub.topic : undefined)),
          ),
        );

        for (const block of newBlocks) {
          if (!block) {
            continue;
          }

          // Given that messagesByTopic should be in order by receiveTime
          // We need to combine all of the messages into a single array and sorted by receive time
          forEachSortedArrays(
            topicsToPreloadForPanel.map((topic) => block.messagesByTopic[topic] ?? []),
            (a, b) => compare(a.receiveTime, b.receiveTime),
            (messageEvent) => {
              // Message blocks may contain topics that we are not subscribed to so we need to filter those out.
              // We use the topicNoConversions and topicConversions to determine if we should include the message event

              if (unconvertedSubscriptionTopics.has(messageEvent.topic)) {
                frames.push(messageEvent);
              }

              // Get the converters available for this topic and schema
              const converters = topicSchemaConverters.get(
                converterKey(messageEvent.topic, messageEvent.schemaName),
              );
              if (converters) {
                for (const converter of converters) {
                  const convertedMessage = converter.converter(messageEvent.message);
                  frames.push({
                    topic: messageEvent.topic,
                    schemaName: converter.toSchemaName,
                    receiveTime: messageEvent.receiveTime,
                    message: convertedMessage,
                    originalMessageEvent: messageEvent,
                    sizeInBytes: messageEvent.sizeInBytes,
                  });
                }
              }
            },
          );
        }
      }
      prevBlocks = newBlocks;
    }

    if (watchedFields.has("currentTime")) {
      if (renderState.currentTime !== activeData?.currentTime) {
        renderState.currentTime = activeData?.currentTime;
        shouldRender = true;
      }
    }

    if (watchedFields.has("startTime")) {
      if (renderState.startTime !== activeData?.startTime) {
        renderState.startTime = activeData?.startTime;
        shouldRender = true;
      }
    }

    if (watchedFields.has("endTime")) {
      if (renderState.endTime !== activeData?.endTime) {
        renderState.endTime = activeData?.endTime;
        shouldRender = true;
      }
    }

    if (watchedFields.has("previewTime")) {
      const startTime = activeData?.startTime;

      if (startTime != undefined && hoverValue != undefined) {
        const stamp = toSec(startTime) + hoverValue.value;
        if (stamp !== renderState.previewTime) {
          shouldRender = true;
        }
        renderState.previewTime = stamp;
      } else {
        if (renderState.previewTime != undefined) {
          shouldRender = true;
        }
        renderState.previewTime = undefined;
      }
    }

    if (watchedFields.has("colorScheme")) {
      if (colorScheme !== renderState.colorScheme) {
        shouldRender = true;
        renderState.colorScheme = colorScheme;
      }
    }

    if (watchedFields.has("appSettings")) {
      if (renderState.appSettings !== appSettings) {
        shouldRender = true;
        renderState.appSettings = appSettings;
      }
    }

    // Update the prev fields with the latest values at the end of all the watch steps
    // Several of the watch steps depend on the comparison against prev and new values
    prevSubscriptions = subscriptions;
    prevMessageConverters = messageConverters;
    prevCollatedConversions = collatedConversions;

    if (!shouldRender) {
      return undefined;
    }

    return renderState;
  };
}

export { initRenderStateBuilder };

/**
 * Function to iterate and call function over multiple sorted arrays in sorted order across all items in all arrays.
 * Time complexity is O(t*n) where t is the number of arrays and n is the total number of items in all arrays.
 * Space complexity is O(t) where t is the number of arrays.
 * @param arrays - sorted arrays to iterate over
 * @param compareFn - function called to compare items in arrays. Returns a positive value if left is larger than right,
 *  a negative value if right is larger than left, or zero if both are equal
 * @param forEach - callback to be executed on all items in the arrays to iterate over in sorted order across all arrays
 */
export function forEachSortedArrays<Item>(
  arrays: Item[][],
  compareFn: (a: Item, b: Item) => number,
  forEach: (item: Item) => void,
): void {
  const cursors: number[] = Array(arrays.length).fill(0);
  if (arrays.length === 0) {
    return;
  }
  for (;;) {
    let minCursorIndex = undefined;
    for (let i = 0; i < cursors.length; i++) {
      const cursor = cursors[i]!;
      const array = arrays[i]!;
      if (cursor >= array.length) {
        continue;
      }
      const item = array[cursor]!;
      if (minCursorIndex == undefined) {
        minCursorIndex = i;
      } else {
        const minItem = arrays[minCursorIndex]![cursors[minCursorIndex]!]!;
        if (compareFn(item, minItem) < 0) {
          minCursorIndex = i;
        }
      }
    }
    if (minCursorIndex == undefined) {
      break;
    }
    const minItem = arrays[minCursorIndex]![cursors[minCursorIndex]!];
    if (minItem != undefined) {
      forEach(minItem);
      cursors[minCursorIndex]++;
    } else {
      break;
    }
  }
}
