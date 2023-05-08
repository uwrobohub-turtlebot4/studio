// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "immer";
import { groupBy } from "lodash";
import { useMemo } from "react";

import parseRosPath from "@foxglove/studio-base/components/MessagePathSyntax/parseRosPath";
import useGlobalVariables, {
  GlobalVariables,
} from "@foxglove/studio-base/hooks/useGlobalVariables";

type MappedTopics = Immutable<{
  topics: string[];
  pathsToTopic: Record<string, string>;
  resolvedPaths: Record<string, string>;
  topicsToPaths: Record<string, string[]>;
}>;

function resolveVariablesInPath(path: string, variables: GlobalVariables): string {
  //   return path.replace(/\$\{([^}]+)\}/g, (_, name) => String(variables[name] ?? ""));
  return path.replace(/\$([^/.]+)/g, (_, name) => String(variables[name] ?? ""));
}

export function useMappedTopics(paths: readonly string[]): MappedTopics {
  const { globalVariables } = useGlobalVariables();

  const resolvedPaths = useMemo(() => {
    return Object.fromEntries(
      paths.map((path) => [path, resolveVariablesInPath(path, globalVariables)]),
    );
  }, [paths, globalVariables]);

  const topicsToPaths = useMemo(
    () =>
      groupBy(paths, (path) => {
        const resolvedPath = resolveVariablesInPath(path, globalVariables);
        return parseRosPath(resolvedPath)?.topicName;
      }),
    [globalVariables, paths],
  );

  const pathsToTopic = useMemo(
    () =>
      Object.fromEntries(
        paths.map((path) => {
          const resolvedPath = resolvedPaths[path] ?? path;
          return [path, parseRosPath(resolvedPath)?.topicName ?? path];
        }),
      ),
    [paths, resolvedPaths],
  );

  return useMemo(
    () => ({
      pathsToTopic,
      resolvedPaths,
      topics: Object.keys(topicsToPaths),
      topicsToPaths,
    }),
    [pathsToTopic, resolvedPaths, topicsToPaths],
  );
}
