// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useMemo } from "react";

import { EventsSyncAdapter } from "@foxglove/studio-base/components/EventsSyncAdapter";
import { OrgExtensionRegistrySyncAdapter } from "@foxglove/studio-base/components/OrgExtensionRegistrySyncAdapter";
import { URLStateSyncAdapter } from "@foxglove/studio-base/components/URLStateSyncAdapter";
import { useAppModule } from "@foxglove/studio-base/context/AppModuleContext";

export function SyncAdapters(): JSX.Element {
  const { syncAdapters } = useAppModule();

  const adapters = useMemo(() => {
    // When there are no sync adapters fall-back to these defaults
    if (!syncAdapters) {
      // eslint-disable-next-line react/jsx-key
      return [<EventsSyncAdapter />, <OrgExtensionRegistrySyncAdapter />];
    }

    return syncAdapters;
  }, [syncAdapters]);

  return (
    <>
      {...adapters}
      <URLStateSyncAdapter />
    </>
  );
}
