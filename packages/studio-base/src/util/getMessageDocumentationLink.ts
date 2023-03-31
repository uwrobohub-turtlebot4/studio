// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { first, kebabCase, last } from "lodash";

import { ros1, ros2galactic } from "@foxglove/rosmsg-msgs-common";
import { foxgloveMessageSchemas } from "@foxglove/schemas/internal";

const ROS1_COMMON_MSG_PACKAGES = new Set(Object.keys(ros1).map((key) => key.split("/")[0]!));
ROS1_COMMON_MSG_PACKAGES.add("turtlesim");

const ROS2_GALACTIC_COMMON_MSG_PACKAGES = new Set(
  Object.keys(ros2galactic).map((key) => key.split("/")[0]!),
);
ROS2_GALACTIC_COMMON_MSG_PACKAGES.add("turtlesim");

const foxgloveDocsLinksBySchemaName = new Map<string, string>();
for (const schema of Object.values(foxgloveMessageSchemas)) {
  const url = `https://foxglove.dev/docs/studio/messages/${kebabCase(schema.name)}`;
  foxgloveDocsLinksBySchemaName.set(`foxglove_msgs/${schema.name}`, url);
  foxgloveDocsLinksBySchemaName.set(`foxglove_msgs/msg/${schema.name}`, url);
  foxgloveDocsLinksBySchemaName.set(`foxglove.${schema.name}`, url);
}

export function getMessageDocumentationLink(schemaName: string): string | undefined {
  const parts = schemaName.split(/[/.]/);
  const pkg = first(parts);
  const filename = last(parts);

  const foxgloveDocsLink = foxgloveDocsLinksBySchemaName.get(schemaName);
  if (foxgloveDocsLink != undefined) {
    return foxgloveDocsLink;
  }

  if (pkg != undefined && ROS1_COMMON_MSG_PACKAGES.has(pkg)) {
    return `https://docs.ros.org/api/${pkg}/html/msg/${filename}.html`;
  } else if (pkg != undefined && ROS2_GALACTIC_COMMON_MSG_PACKAGES.has(pkg)) {
    return `https://docs.ros2.org/galactic/api/${pkg}/msg/${filename}.html`;
  }

  return undefined;
}
