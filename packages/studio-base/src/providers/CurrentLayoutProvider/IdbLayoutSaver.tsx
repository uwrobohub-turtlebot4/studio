// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useCallback, useEffect, useState } from "react";

import {
  LayoutState,
  useCurrentLayoutActions,
  useCurrentLayoutSelector,
} from "@foxglove/studio-base/context/CurrentLayoutContext";
import { LayoutData } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";

import { IdbLayoutStorage } from "./IdbLayoutStorage";
import { defaultLayout } from "./defaultLayout";

function selectLayoutData(state: LayoutState) {
  return state.selectedLayout?.data;
}

export function IdbLayoutSaver(): JSX.Element {
  const [layoutStorage] = useState(() => new IdbLayoutStorage());

  const { setCurrentLayoutData } = useCurrentLayoutActions();
  const currentLayoutData = useCurrentLayoutSelector(selectLayoutData);

  const saveData = useCallback(
    async (data: LayoutData) => {
      await layoutStorage.put(data);
    },
    [layoutStorage],
  );

  useEffect(() => {
    if (currentLayoutData) {
      // fixme - debounce
      void saveData(currentLayoutData);
    }
  }, [currentLayoutData, saveData]);

  useEffect(() => {
    async function init() {
      const existingLayoutData = await layoutStorage.get();
      setCurrentLayoutData(existingLayoutData ?? defaultLayout);
    }

    // fixme - errors?
    void init();
  }, [layoutStorage, setCurrentLayoutData]);

  return <></>;
}
