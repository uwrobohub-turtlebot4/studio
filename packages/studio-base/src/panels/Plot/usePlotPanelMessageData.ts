// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "immer";
import { assignWith, groupBy, isEmpty, last, pick } from "lodash";
import memoizeWeak from "memoize-weak";
import { useCallback, useEffect, useMemo, useState } from "react";

import {
  isTimeInRangeInclusive,
  isLessThan,
  compare,
  isGreaterThan,
  Time,
  subtract,
} from "@foxglove/rostime";
import { filterMap } from "@foxglove/studio-base/../../den/collection";
import { useBlocksByTopic, useMessageReducer } from "@foxglove/studio-base/PanelAPI";
import { MessageBlock } from "@foxglove/studio-base/PanelAPI/useBlocksByTopic";
import parseRosPath, {
  getTopicsFromPaths,
} from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import {
  MessageDataItemsByPath,
  useCachedGetMessagePathDataItems,
  useDecodeMessagePathsForMessagesByTopic,
} from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { ChartDefaultView } from "@foxglove/studio-base/components/TimeBasedChart";
import { PlotDataByPath, PlotDataItem } from "@foxglove/studio-base/panels/Plot/internalTypes";
import { MessageEvent } from "@foxglove/studio-base/players/types";
import { getTimestampForMessage } from "@foxglove/studio-base/util/time";

const MAX_TIME = { sec: Infinity, nsec: Infinity };
const MIN_TIME = { sec: -Infinity, nsec: -Infinity };

function minTime(a: Time, b: Time): Time {
  return isLessThan(a, b) ? a : b;
}

function maxTime(a: Time, b: Time): Time {
  return isLessThan(a, b) ? b : a;
}

/**
 * Find the earliest and latest times of messages in data.
 */
export const timeRangeForPlotData = memoizeWeak(
  (data: Immutable<PlotDataByPath>): { start: Time; end: Time } => {
    let start: Time = MAX_TIME;
    let end: Time = MIN_TIME;
    for (const path of Object.keys(data)) {
      for (const item of data[path] ?? []) {
        for (const datum of item) {
          start = minTime(start, datum.receiveTime);
          end = maxTime(end, datum.receiveTime);
        }
      }
    }

    return { start, end };
  },
);

/**
 * Fetch the data we need from each item in itemsByPath and discard the rest of
 * the message to save memory.
 */
const getPlotDataByPath = (itemsByPath: MessageDataItemsByPath): PlotDataByPath => {
  const ret: PlotDataByPath = {};
  Object.entries(itemsByPath).forEach(([path, items]) => {
    ret[path] = [
      items.map((messageAndData) => {
        const headerStamp = getTimestampForMessage(messageAndData.messageEvent.message);
        return {
          queriedData: messageAndData.queriedData,
          receiveTime: messageAndData.messageEvent.receiveTime,
          headerStamp,
        };
      }),
    ];
  });
  return ret;
};

const getMessagePathItemsForBlock = memoizeWeak(
  (
    decodeMessagePathsForMessagesByTopic: (_: MessageBlock) => MessageDataItemsByPath,
    block: MessageBlock,
  ): PlotDataByPath => {
    return Object.freeze(getPlotDataByPath(decodeMessagePathsForMessagesByTopic(block)));
  },
);

/**
 * Fetch all the plot data we want for our current subscribed topics from blocks.
 */
export function getBlockItemsByPath(
  decodeMessagePathsForMessagesByTopic: (_: MessageBlock) => MessageDataItemsByPath,
  blocks: readonly MessageBlock[],
): PlotDataByPath {
  const ret: PlotDataByPath = {};
  const lastBlockIndexForPath: Record<string, number> = {};
  let count = 0;
  let i = 0;
  for (const block of blocks) {
    const messagePathItemsForBlock: PlotDataByPath = getMessagePathItemsForBlock(
      decodeMessagePathsForMessagesByTopic,
      block,
    );

    // After 1 million data points we check if there is more memory to continue loading more
    // data points. This helps prevent runaway memory use if the user tried to plot a binary topic.
    //
    // An example would be to try plotting `/map.data[:]` where map is an occupancy grid
    // this can easily result in many millions of points.
    if (count >= 1_000_000) {
      // if we have memory stats we can let the user have more points as long as memory is not under pressure
      if (performance.memory) {
        const pct = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
        if (isNaN(pct) || pct > 0.6) {
          return ret;
        }
      } else {
        return ret;
      }
    }

    for (const [path, messagePathItems] of Object.entries(messagePathItemsForBlock)) {
      count += messagePathItems[0]?.[0]?.queriedData.length ?? 0;

      const existingItems = ret[path] ?? [];
      // getMessagePathItemsForBlock returns an array of exactly one range of items.
      const [pathItems] = messagePathItems;
      if (lastBlockIndexForPath[path] === i - 1) {
        // If we are continuing directly from the previous block index (i - 1) then add to the
        // existing range, otherwise start a new range
        const currentRange = existingItems[existingItems.length - 1];
        if (currentRange && pathItems) {
          for (const item of pathItems) {
            currentRange.push(item);
          }
        }
      } else {
        if (pathItems) {
          // Start a new contiguous range. Make a copy so we can extend it.
          existingItems.push(pathItems.slice());
        }
      }
      ret[path] = existingItems;
      lastBlockIndexForPath[path] = i;
    }

    i += 1;
  }
  return ret;
}

/**
 * Merge two PlotDataByPath objects into a single PlotDataByPath object,
 * discarding any overlapping messages between the two items.
 */
function mergePlotDataByPath(a: PlotDataByPath, b: PlotDataByPath): PlotDataByPath {
  return assignWith(
    { ...a },
    b,
    (objValue: undefined | PlotDataItem[][], srcValue: undefined | PlotDataItem[][]) => {
      if (objValue == undefined) {
        return srcValue;
      }
      const lastTime = last(last(objValue))?.receiveTime ?? MIN_TIME;
      const newValues = filterMap(srcValue ?? [], (item) => {
        const laterDatums = item.filter((datum) => isGreaterThan(datum.receiveTime, lastTime));
        return laterDatums.length > 0 ? laterDatums : undefined;
      });
      return objValue.concat(newValues);
    },
  );
}

/**
 * Reduce multiple PlotDataByPath objects into a single PlotDataByPath object,
 * concatenating messages for each path after trimming messages that overlap
 * between items.
 */
export function combinePlotData(data: PlotDataByPath[]): PlotDataByPath {
  const sorted = data
    .slice()
    .sort((a, b) => compare(timeRangeForPlotData(a).start, timeRangeForPlotData(b).start));
  const reduced = sorted.reduce((acc, item) => {
    if (isEmpty(acc)) {
      return item;
    }
    return mergePlotDataByPath(acc, item);
  }, {} as PlotDataByPath);
  return reduced;
}

type TaggedPlotDataByPath = { tag: string; data: PlotDataByPath };

type Params = {
  allPaths: string[];
  followingView: undefined | ChartDefaultView;
  showSingleCurrentMessage: boolean;
};

export function usePlotPanelMessageData(params: Params): PlotDataByPath {
  const { allPaths, followingView, showSingleCurrentMessage } = params;

  // When iterating message events, we need a reverse lookup from topic to the paths that requested
  // the topic.
  const topicToPaths = useMemo(
    () => groupBy(allPaths, (path) => parseRosPath(path)?.topicName),
    [allPaths],
  );

  const subscribeTopics = useMemo(() => getTopicsFromPaths(allPaths), [allPaths]);

  const blocks = useBlocksByTopic(subscribeTopics);

  const decodeMessagePathsForMessagesByTopic = useDecodeMessagePathsForMessagesByTopic(allPaths);

  // This memoization isn't quite ideal: getDatasets is a bit expensive with lots of preloaded data,
  // and when we preload a new block we re-generate the datasets for the whole timeline. We could
  // try to use block memoization here.
  const plotDataForBlocks = useMemo(() => {
    if (showSingleCurrentMessage) {
      return {};
    }
    return getBlockItemsByPath(decodeMessagePathsForMessagesByTopic, blocks);
  }, [blocks, decodeMessagePathsForMessagesByTopic, showSingleCurrentMessage]);

  const cachedGetMessagePathDataItems = useCachedGetMessagePathDataItems(allPaths);

  const blocksTimeRange = timeRangeForPlotData(plotDataForBlocks);

  // When restoring, keep only the paths that are present in allPaths.
  // Without this, the reducer value will grow unbounded with new paths as users add/remove series.
  const restore = useCallback(
    (previous?: TaggedPlotDataByPath): TaggedPlotDataByPath => {
      if (!previous) {
        return { tag: new Date().toISOString(), data: {} };
      }

      return { ...previous, data: pick(previous.data, allPaths) };
    },
    [allPaths],
  );

  const addMessages = useCallback(
    (accumulated: TaggedPlotDataByPath, msgEvents: readonly MessageEvent<unknown>[]) => {
      const lastEventTime = msgEvents[msgEvents.length - 1]?.receiveTime;
      const isFollowing = followingView?.type === "following";

      // If we don't change any accumulated data, avoid returning a new "accumulated" object so
      // react hooks remain stable.
      let newAccumulated: TaggedPlotDataByPath | undefined;

      for (const msgEvent of msgEvents) {
        const paths = topicToPaths[msgEvent.topic];
        if (!paths) {
          continue;
        }

        for (const path of paths) {
          const dataItem = cachedGetMessagePathDataItems(path, msgEvent);
          if (!dataItem) {
            continue;
          }

          const headerStamp = getTimestampForMessage(msgEvent.message);
          if (
            isTimeInRangeInclusive(msgEvent.receiveTime, blocksTimeRange.start, blocksTimeRange.end)
          ) {
            // Skip messages that fall within the range of our block data since
            // we would just filter them out later anyway.
            continue;
          }
          const plotDataItem = {
            queriedData: dataItem,
            receiveTime: msgEvent.receiveTime,
            headerStamp,
          };

          newAccumulated ??= { ...accumulated };

          if (showSingleCurrentMessage) {
            newAccumulated.data[path] = [[plotDataItem]];
          } else {
            const plotDataPath = newAccumulated.data[path]?.slice() ?? [[]];
            // PlotDataPaths have 2d arrays of items to accommodate blocks which may have gaps so
            // each continuous set of blocks forms one continuous line. For streaming messages we
            // treat this as one continuous set of items and always add to the first "range"
            const plotDataItems = plotDataPath[0]!;

            // If we are using the _following_ view mode, truncate away any items older than the view window.
            if (lastEventTime && isFollowing) {
              const minStamp = subtract(lastEventTime, { sec: followingView.width, nsec: 0 });
              const newItems = plotDataItems.filter(
                (item) => !isLessThan(item.receiveTime, minStamp),
              );
              newItems.push(plotDataItem);
              plotDataPath[0] = newItems;
            } else {
              plotDataPath[0] = plotDataItems.concat(plotDataItem);
            }

            newAccumulated.data[path] = plotDataPath;
          }
        }
      }

      return newAccumulated ?? accumulated;
    },
    [
      blocksTimeRange,
      cachedGetMessagePathDataItems,
      followingView,
      showSingleCurrentMessage,
      topicToPaths,
    ],
  );

  const plotDataByPath = useMessageReducer<TaggedPlotDataByPath>({
    topics: subscribeTopics,
    preloadType: "full",
    restore,
    addMessages,
  });

  const [accumulatedPathIntervals, setAccumulatedPathIntervals] = useState<
    Record<string, PlotDataByPath>
  >({});

  useEffect(() => {
    if (!isEmpty(plotDataByPath.data)) {
      setAccumulatedPathIntervals((oldValue) => ({
        ...oldValue,
        blocks: plotDataForBlocks,
        [plotDataByPath.tag]: plotDataByPath.data,
      }));
    }
  }, [plotDataByPath, plotDataForBlocks]);

  const combinedPlotData = useMemo(
    () => combinePlotData(Object.values(accumulatedPathIntervals)),
    [accumulatedPathIntervals],
  );

  return combinedPlotData;
}
