// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useLayoutEffect, useReducer, useState } from "react";
import { v4 as uuidv4 } from "uuid";

import { PanelExtensionContext, SettingsTreeAction } from "@foxglove/studio";

import { settingsActionReducer, useSettingsTree } from "./settings";
import type { Config } from "./types";

type Props = {
  context: PanelExtensionContext;
};

const defaultConfig: Config = {
  serviceName: undefined,
};

type State = {
  path: string;
  error: Error | undefined;
};

export function Services({ context }: Props): JSX.Element {
  // panel extensions must notify when they've completed rendering
  // onRender will setRenderDone to a done callback which we can invoke after we've rendered
  const [renderDone, setRenderDone] = useState<() => void>(() => () => {});

  const [config, setConfig] = useState(() => ({
    ...defaultConfig,
    ...(context.initialState as Partial<Config>),
  }));

  useEffect(() => {
    context.saveState(config);
    context.setDefaultPanelTitle(config.serviceName);
  }, [config, context]);

  useEffect(() => {
    context.onRender = (renderState, done) => {
      setRenderDone(() => done);

      if (renderState.services) {
        // dispatch({ type: "frame", messages: renderState.currentFrame });
      }
    };
    context.watch("services");

    return () => {
      context.onRender = undefined;
    };
  }, [context]);

  const settingsActionHandler = useCallback(
    (action: SettingsTreeAction) =>
      setConfig((prevConfig) => settingsActionReducer(prevConfig, action)),
    [setConfig],
  );

  // const settingsTree = useSettingsTree(config, state.pathParseError, state.error?.message);
  // useEffect(() => {
  //   context.updatePanelSettingsEditor({
  //     actionHandler: settingsActionHandler,
  //     nodes: settingsTree,
  //   });
  // }, [context, settingsActionHandler, settingsTree]);

  // useEffect(() => {
  //   if (state.parsedPath?.topicName != undefined) {
  //     context.subscribe([state.parsedPath.topicName]);
  //   }
  //   return () => context.unsubscribeAll();
  // }, [context, state.parsedPath?.topicName]);

  // Indicate render is complete - the effect runs after the dom is updated
  useEffect(() => {
    renderDone();
  }, [renderDone]);

  return <div></div>;
}
