// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { useEffect, useMemo, useState, useRef } from "react";

import Log from "@foxglove/log";
import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import { useCurrentLayoutActions } from "@foxglove/studio-base/context/CurrentLayoutContext";
import { LayoutData } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";
import { useCurrentUser } from "@foxglove/studio-base/context/CurrentUserContext";
import { EventsStore, useEvents } from "@foxglove/studio-base/context/EventsContext";
import { useLayoutManager } from "@foxglove/studio-base/context/LayoutManagerContext";
import { usePlayerSelection } from "@foxglove/studio-base/context/PlayerSelectionContext";
import useCallbackWithToast from "@foxglove/studio-base/hooks/useCallbackWithToast";
import { PlayerPresence } from "@foxglove/studio-base/players/types";
import { AppURLState, parseAppURLState } from "@foxglove/studio-base/util/appURLState";

//import { LayoutID } from "../services/ConsoleApi";
import { LayoutID } from "@foxglove/studio-base";

const selectPlayerPresence = (ctx: MessagePipelineContext) => ctx.playerState.presence;
const selectSeek = (ctx: MessagePipelineContext) => ctx.seekPlayback;
const selectSelectEvent = (store: EventsStore) => store.selectEvent;

const log = Log.getLogger(__filename);

export function formatLayoutUrl(layoutUrl: URL): string {
  return layoutUrl.pathname.replace(/.*\//, "").replace(".json", "");
}

/*
 * Separation of sync functions is necessary to prevent memory leak from context kept in
 * useEffect closures. Notably `seekPlayback` being attached to the context of the `useEffect`
 * closures that don't use it and aren't updated when it changes. Otherwise the old memoized callbacks
 * of these functions are kept in React state with the context that includes the old player, preventing
 * garbage collection of the old player.
 */

function useSyncSourceFromUrl(
  targetUrlState: AppURLState | undefined,
  { currentUserRequired }: { currentUserRequired: boolean },
) {
  const [unappliedSourceArgs, setUnappliedSourceArgs] = useState(
    targetUrlState ? { ds: targetUrlState.ds, dsParams: targetUrlState.dsParams } : undefined,
  );
  const { selectSource } = usePlayerSelection();
  const selectEvent = useEvents(selectSelectEvent);
  const { currentUser } = useCurrentUser();
  // Load data source from URL.
  useEffect(() => {
    if (!unappliedSourceArgs) {
      return;
    }

    // Wait for current user session if one is required for this source.
    if (currentUserRequired && !currentUser) {
      return;
    }

    // Apply any available datasource args
    if (unappliedSourceArgs.ds) {
      log.debug("Initialising source from url", unappliedSourceArgs);
      selectSource(unappliedSourceArgs.ds, {
        type: "connection",
        params: unappliedSourceArgs.dsParams,
      });
      selectEvent(unappliedSourceArgs.dsParams?.eventId);
      setUnappliedSourceArgs({ ds: undefined, dsParams: undefined });
    }
  }, [
    currentUser,
    currentUserRequired,
    selectEvent,
    selectSource,
    unappliedSourceArgs,
    setUnappliedSourceArgs,
  ]);
}

function useSyncLayoutFromUrl(
  targetUrlState: AppURLState | undefined,
  { currentUserRequired }: { currentUserRequired: boolean },
) {
  const { setSelectedLayoutId } = useCurrentLayoutActions();
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const layoutManager = useLayoutManager();
  const [unappliedLayoutArgs, setUnappliedLayoutArgs] = useState<
    | {
        layoutId?: LayoutID;
        layoutUrl?: string;
      }
    | undefined
  >(
    targetUrlState
      ? { layoutId: targetUrlState.layoutId, layoutUrl: targetUrlState.layoutUrl }
      : undefined,
  );
  const fetchingLayout = useRef(false);

  const fetchLayout = useCallbackWithToast(
    async (url: URL, name: string) => {
      let res;
      try {
        res = await fetch(url.href);
      } catch {
        throw `Could not load the layout from ${url}`;
      }
      if (!res.ok) {
        throw `Could not load the layout from ${url}`;
      }
      let data: LayoutData;
      try {
        data = await res.json();
      } catch {
        throw `${url} does not contain valid layout JSON`;
      }

      const layouts = await layoutManager.getLayouts();
      const sourceLayout = layouts.find((layout) => layout.name === name);

      let newLayout;
      if (sourceLayout == undefined) {
        newLayout = await layoutManager.saveNewLayout({
          name,
          data,
          permission: "CREATOR_WRITE",
        });
      } else {
        newLayout = await layoutManager.updateLayout({
          id: sourceLayout.id,
          name,
          data,
        });
      }

      setSelectedLayoutId(newLayout.id);
      setUnappliedLayoutArgs((oldState) => ({ ...oldState, layoutUrl: undefined }));
    },
    [setSelectedLayoutId, layoutManager],
  );

  // Select layout from URL.
  useEffect(() => {
    if (unappliedLayoutArgs?.layoutId) {
      // If our datasource requires a current user then wait until the player is
      // available to load the layout since we may need to sync layouts first and
      // that's only possible after the user has logged in.
      if (currentUserRequired && playerPresence !== PlayerPresence.PRESENT) {
        return;
      }

      log.debug(`Initializing layout from url: ${unappliedLayoutArgs.layoutId}`);
      setSelectedLayoutId(unappliedLayoutArgs.layoutId);
      setUnappliedLayoutArgs((oldState) => ({ ...oldState, layoutId: undefined }));
    }

    if (unappliedLayoutArgs?.layoutUrl && !fetchingLayout.current) {
      const url = new URL(unappliedLayoutArgs.layoutUrl);
      const name = formatLayoutUrl(url);
      log.debug(`Trying to load layout ${name} from ${url}`);

      fetchingLayout.current = true;
      fetchLayout(url, name)
        .catch(() => {
          return;
        })
        .finally(() => {
          fetchingLayout.current = false;
        });
    }
  }, [
    currentUserRequired,
    playerPresence,
    setSelectedLayoutId,
    unappliedLayoutArgs?.layoutId,
    unappliedLayoutArgs?.layoutUrl,
    fetchLayout,
    fetchingLayout,
  ]);
}

function useSyncTimeFromUrl(targetUrlState: AppURLState | undefined) {
  const seekPlayback = useMessagePipeline(selectSeek);
  const playerPresence = useMessagePipeline(selectPlayerPresence);
  const [unappliedTime, setUnappliedTime] = useState(
    targetUrlState ? { time: targetUrlState.time } : undefined,
  );
  // Seek to time in URL.
  useEffect(() => {
    if (unappliedTime?.time == undefined || !seekPlayback) {
      return;
    }

    // Wait until player is ready before we try to seek.
    if (playerPresence !== PlayerPresence.PRESENT) {
      return;
    }

    log.debug(`Seeking to url time:`, unappliedTime.time);
    seekPlayback(unappliedTime.time);
    setUnappliedTime({ time: undefined });
  }, [playerPresence, seekPlayback, unappliedTime]);
}

/**
 * Restores our session state from any deep link we were passed on startup.
 */
export function useInitialDeepLinkState(deepLinks: readonly string[]): {
  currentUserRequired: boolean;
} {
  const { availableSources } = usePlayerSelection();
  const targetUrlState = useMemo(
    () => (deepLinks[0] ? parseAppURLState(new URL(deepLinks[0])) : undefined),
    [deepLinks],
  );

  // Maybe this should be abstracted somewhere but that would require a
  // more intimate interface with this hook and the player selection logic.
  const currentUserRequiredParam = useMemo(() => {
    let currentUserRequired = false;
    const ds = targetUrlState?.ds;
    const foundSource =
      ds == undefined
        ? undefined
        : availableSources.find((source) => source.id === ds || source.legacyIds?.includes(ds));
    if (foundSource) {
      currentUserRequired = foundSource.currentUserRequired ?? false;
    }

    return { currentUserRequired };
  }, [targetUrlState?.ds, availableSources]);
  useSyncSourceFromUrl(targetUrlState, currentUserRequiredParam);
  useSyncLayoutFromUrl(targetUrlState, currentUserRequiredParam);
  useSyncTimeFromUrl(targetUrlState);
  return currentUserRequiredParam;
}
