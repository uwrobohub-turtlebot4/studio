// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "immer";
import { assignWith, isEmpty, last } from "lodash";
import memoizeWeak from "memoize-weak";

import { filterMap } from "@foxglove/den/collection";
import { Time, compare, isGreaterThan, isLessThan } from "@foxglove/rostime";
import { MessageBlock } from "@foxglove/studio-base/PanelAPI/useBlocksByTopic";
import { MessageDataItemsByPath } from "@foxglove/studio-base/components/MessagePathSyntax/useCachedGetMessagePathDataItems";
import { PlotDataByPath, PlotDataItem } from "@foxglove/studio-base/panels/Plot/internalTypes";
import { getTimestampForMessage } from "@foxglove/studio-base/util/time";

const MAX_TIME = { sec: Infinity, nsec: Infinity };
const MIN_TIME = { sec: -Infinity, nsec: -Infinity };

function minTime(a: Time, b: Time): Time {
  return isLessThan(a, b) ? a : b;
}

function maxTime(a: Time, b: Time): Time {
  return isLessThan(a, b) ? b : a;
}

// messagePathItems contains the whole parsed message, and we don't need to cache all of that.
// Instead, throw away everything but what we need (the timestamps).
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

const performance = window.performance;

const getMessagePathItemsForBlock = memoizeWeak(
  (
    decodeMessagePathsForMessagesByTopic: (_: MessageBlock) => MessageDataItemsByPath,
    block: MessageBlock,
  ): PlotDataByPath => {
    return Object.freeze(getPlotDataByPath(decodeMessagePathsForMessagesByTopic(block)));
  },
);

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

export function reducePlotData(data: PlotDataByPath[]): PlotDataByPath {
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
