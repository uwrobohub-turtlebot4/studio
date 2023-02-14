// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { createContext, useContext } from "react";

interface IAppModule {
  providers?: readonly JSX.Element[];
  syncAdapters?: readonly JSX.Element[];
  createEvent?: (args: {
    deviceId: string;
    timestamp: string;
    durationNanos: string;
    metadata: Record<string, string>;
  }) => Promise<void>;
}

const AppModuleContext = createContext<IAppModule>({});
AppModuleContext.displayName = "AppModuleContext";

export function useAppModule(): IAppModule {
  return useContext(AppModuleContext);
}

export { AppModuleContext };
export type { IAppModule };
