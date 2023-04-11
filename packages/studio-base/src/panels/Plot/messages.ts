// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "immer";
import { assignWith, isEmpty, last, sortBy } from "lodash";
import memoizeWeak from "memoize-weak";

import { filterMap } from "@foxglove/den/collection";
import { Time, isGreaterThan, isLessThan } from "@foxglove/rostime";
import { PlotDataByPath, PlotDataItem } from "@foxglove/studio-base/panels/Plot/internalTypes";

const MAX_TIME = { sec: Infinity, nsec: Infinity };
const MIN_TIME = { sec: -Infinity, nsec: -Infinity };

function minTime(a: Time, b: Time): Time {
  return isLessThan(a, b) ? a : b;
}

function maxTime(a: Time, b: Time): Time {
  return isLessThan(a, b) ? b : a;
}

function timeRangeForPlotData(data: Immutable<PlotDataByPath>): { start: Time; end: Time } {
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
}

const memoTimeRangeForPlotData = memoizeWeak(timeRangeForPlotData);

function mergePlotDataByPath(a: PlotDataByPath, b: PlotDataByPath): PlotDataByPath {
  return assignWith(
    { ...a },
    b,
    (objValue: undefined | PlotDataItem[][], srcValue: undefined | PlotDataItem[][]) => {
      if (objValue == undefined) {
        return srcValue;
      }
      //   return objValue ?? srcValue;
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
  const sorted = sortBy(data, memoTimeRangeForPlotData);
  return sorted.reduce((_acc, item) => {
    if (isEmpty(_acc)) {
      return item;
    }
    return mergePlotDataByPath(_acc, item);
  }, {} as PlotDataByPath);
}
