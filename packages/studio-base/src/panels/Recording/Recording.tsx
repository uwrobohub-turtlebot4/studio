// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { PanelExtensionContext, SettingsTreeAction } from "@foxglove/studio";

import type { Config } from "./types";

type Props = {
  context: PanelExtensionContext;
};

const defaultConfig: Config = {};

export function Recording({ context }: Props): JSX.Element {
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});

  const [config, setConfig] = useState(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));

  useEffect(() => {
    context.saveState(config);
  }, [config, context]);

  useEffect(() => {
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);

      if (renderState.didSeek === true) {
        //
      }

      //
    };
    context.watch("currentFrame");
    context.watch("didSeek");
    context.watch("topics");

    return () => {
      context.onRender = undefined;
    };
  }, [context]);

  // const settingsActionHandler = useCallback(
  //   (action: SettingsTreeAction) =>
  //     setConfig((prevConfig) => settingsActionReducer(prevConfig, action)),
  //   [setConfig],
  // );

  // const settingsTree = useSettingsTree(config, state.pathParseError, state.error?.message);
  // useEffect(() => {
  //   context.updatePanelSettingsEditor({
  //     actionHandler: settingsActionHandler,
  //     nodes: settingsTree,
  //   });
  // }, [context, settingsActionHandler, settingsTree]);

  useEffect(() => {
    if (state.parsedPath?.topicName != undefined) {
      context.subscribe([state.parsedPath.topicName]);
    }
    return () => context.unsubscribeAll();
  }, [context, state.parsedPath?.topicName]);

  // Indicate render is complete - the effect runs after the dom is updated
  useEffect(() => {
    renderDone();
  }, [renderDone]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-around",
        alignItems: "center",
        overflow: "hidden",
        padding: 8,
      }}
    >
      <div style={{ width: "100%", overflow: "hidden" }}>
        <div
          style={{
            position: "relative",
            maxWidth: "100%",
            maxHeight: "100%",
            aspectRatio: `${width} / ${height}`,
            margin: "0 auto",
            transform: "scale(1)", // Work around a Safari bug: https://bugs.webkit.org/show_bug.cgi?id=231849
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: getConicGradient(config, width, height, gaugeAngle),
              clipPath: `url(#${clipPathId})`,
              opacity: state.latestMatchingQueriedData == undefined ? 0.5 : 1,
            }}
          />
          <div
            style={{
              backgroundColor: outOfBounds ? "orange" : "white",
              width: needleThickness,
              height: `${(100 * (radius + needleExtraLength)) / height}%`,
              border: "2px solid black",
              borderRadius: needleThickness / 2,
              position: "absolute",
              bottom: `${100 * (1 - centerY / height)}%`,
              left: "50%",
              transformOrigin: "bottom left",
              margin: "0 auto",
              transform: [
                `scaleZ(1)`,
                `rotate(${
                  -Math.PI / 2 + gaugeAngle + scaledValue * 2 * (Math.PI / 2 - gaugeAngle)
                }rad)`,
                `translateX(${-needleThickness / 2}px)`,
                `translateY(${needleThickness / 2}px)`,
              ].join(" "),
              display: Number.isFinite(scaledValue) ? "block" : "none",
            }}
          />
        </div>
        <svg style={{ position: "absolute" }}>
          <clipPath id={clipPathId} clipPathUnits="objectBoundingBox">
            <path
              transform={`scale(${1 / width}, ${1 / height})`}
              d={[
                `M ${centerX - radius * Math.cos(gaugeAngle)},${
                  centerY - radius * Math.sin(gaugeAngle)
                }`,
                `A 0.5,0.5 0 ${gaugeAngle < 0 ? 1 : 0} 1 ${
                  centerX + radius * Math.cos(gaugeAngle)
                },${centerY - radius * Math.sin(gaugeAngle)}`,
                `L ${centerX + innerRadius * Math.cos(gaugeAngle)},${
                  centerY - innerRadius * Math.sin(gaugeAngle)
                }`,
                `A ${innerRadius},${innerRadius} 0 ${gaugeAngle < 0 ? 1 : 0} 0 ${
                  centerX - innerRadius * Math.cos(gaugeAngle)
                },${centerY - innerRadius * Math.sin(gaugeAngle)}`,
                `Z`,
              ].join(" ")}
            />
          </clipPath>
        </svg>
      </div>
    </div>
  );
}
