// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { MessageEvent } from "@foxglove/studio-base/players/types";

/**
 * Determines the namespaced settings key for a topic + schema or MessageEvent. This is
 * used to prevent potential clashes in the config under /topics caused by message
 * converters.
 */
function settingsKeyForMessage(message: MessageEvent<unknown>): string {
  return settingsKeyForTopic(message.topic, message.schemaName);
}

function settingsKeyForTopic(topic: string, schema: string): string {
  return `${encodeURIComponent(topic)}:${encodeURIComponent(schema)}`;
}

export const settingsKeys = {
  forMessage: settingsKeyForMessage,
  forTopic: settingsKeyForTopic,
};
