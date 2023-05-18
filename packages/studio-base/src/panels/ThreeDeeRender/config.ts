// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "immer";
import { transform } from "lodash";
import { DeepPartial, DeepWritable } from "ts-essentials";

import { Topic } from "@foxglove/studio";
import { FollowMode, ImageModeConfig } from "@foxglove/studio-base/panels/ThreeDeeRender/IRenderer";
import { MeshUpAxis } from "@foxglove/studio-base/panels/ThreeDeeRender/ModelCache";
import { CameraState } from "@foxglove/studio-base/panels/ThreeDeeRender/camera";
import { ALL_FOXGLOVE_DATATYPES } from "@foxglove/studio-base/panels/ThreeDeeRender/foxglove";
import { LayerSettingsTransform } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/FrameAxes";
import { PublishClickType } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/PublishClickTool";
import { ALL_ROS_DATATYPES } from "@foxglove/studio-base/panels/ThreeDeeRender/ros";
import {
  BaseSettings,
  CustomLayerSettings,
} from "@foxglove/studio-base/panels/ThreeDeeRender/settings";
import { settingsKeys } from "@foxglove/studio-base/panels/ThreeDeeRender/settingsKeys";

export type RendererConfigV1 = {
  /** Camera settings for the currently rendering scene */
  cameraState: CameraState;
  /** Coordinate frameId of the rendering frame */
  followTf: string | undefined;
  /** Camera follow mode */
  followMode: FollowMode;
  scene: {
    /** Show rendering metrics in a DOM overlay */
    enableStats?: boolean;
    /** Background color override for the scene, sent to `glClearColor()` */
    backgroundColor?: string;
    /* Scale factor to apply to all labels */
    labelScaleFactor?: number;
    /** Ignore the <up_axis> tag in COLLADA files (matching rviz behavior) */
    ignoreColladaUpAxis?: boolean;
    meshUpAxis?: MeshUpAxis;
    transforms?: {
      /** Toggles translation and rotation offset controls for frames */
      editable?: boolean;
      /** Toggles visibility of frame axis labels */
      showLabel?: boolean;
      /** Size of frame axis labels */
      labelSize?: number;
      /** Size of coordinate frame axes */
      axisScale?: number;
      /** Width of the connecting line between child and parent frames */
      lineWidth?: number;
      /** Color of the connecting line between child and parent frames */
      lineColor?: string;
      /** Enable transform preloading */
      enablePreloading?: boolean;
    };
    /** Sync camera with other 3d panels */
    syncCamera?: boolean;
    /** Toggles visibility of all topics */
    topicsVisible?: boolean;
  };
  publish: {
    /** The type of message to publish when clicking in the scene */
    type: PublishClickType;
    /** The topic on which to publish poses */
    poseTopic: string;
    /** The topic on which to publish points */
    pointTopic: string;
    /** The topic on which to publish pose estimates */
    poseEstimateTopic: string;
    /** The X standard deviation to publish with poses */
    poseEstimateXDeviation: number;
    /** The Y standard deviation to publish with poses */
    poseEstimateYDeviation: number;
    /** The theta standard deviation to publish with poses */
    poseEstimateThetaDeviation: number;
  };
  /** frameId -> settings */
  transforms: Record<string, Partial<LayerSettingsTransform> | undefined>;
  /** topicName -> settings */
  topics: Record<string, Partial<BaseSettings> | undefined>;
  /** instanceId -> settings */
  layers: Record<string, Partial<CustomLayerSettings> | undefined>;

  /** Settings pertaining to Image mode */
  imageMode: ImageModeConfig;
};

type RendererConfigV2 = RendererConfigV1 & {
  version: "2";
};

export type AnyRendererConfig = RendererConfigV1 | RendererConfigV2;
export type RendererConfig = RendererConfigV2;

function sclone<T>(val: T): DeepWritable<T> {
  return structuredClone(val) as DeepWritable<T>;
}

// /**
//  * Determines the namespaced settings key for a topic. This is necessary to
//  * prevent potential topic namespace collisions caused by message converters.
//  *
//  * For this to return stable results the message converters must be registered
//  * in a consistent order. In return we can claim a converted topic directly
//  * under /topic/topicName if there and avoid migrating existing,
//  * non-namespaced layouts.
//  */
// public settingsKeyForTopic(topicName: string): string {
//   const topic = this.renderer.topicsByName?.get(topicName);
//   if (!topic) {
//     return topicName;
//   }

//   // If we support this schema directly claim the unnamespaced topic name.
//   if (this.supportedSchemas().includes(topic.schemaName)) {
//     return topicName;
//   }

//   // If no direct handler exists and we're the first listed converter then also claim
//   // the unnamespaced topic name.
//   const directHandlerExists = this.renderer.schemaHandlers.has(topic.schemaName);
//   const converterOrder = findIndex(topic.convertibleTo, (schema) =>
//     this.supportedSchemas().includes(schema),
//   );
//   if (converterOrder === 0 && !directHandlerExists) {
//     return topic.name;
//   }

//   // Otherwise we need to namespace the topic name with the converted schema.
//   return settingsTopicKey(topic.name, topic.convertibleTo?.[converterOrder] ?? topic.schemaName);
// }

const ALL_SUPPORTED_SCHEMAS = new Set([...ALL_ROS_DATATYPES, ...ALL_FOXGLOVE_DATATYPES]);

export function migrateConfig(
  oldConfig: Immutable<DeepPartial<RendererConfigV1 | RendererConfigV2>>,
  topics: Immutable<Topic[]>,
): DeepPartial<RendererConfig> {
  if ("version" in oldConfig) {
    return sclone(oldConfig);
  }

  const mappedTopics = transform(
    oldConfig.topics ?? {},
    (acc, value, key) => {
      const topic = topics.find((top) => top.name === key);
      if (topic) {
        const convertibleSchema = topic.convertibleTo?.find((schema) =>
          ALL_SUPPORTED_SCHEMAS.has(schema),
        );
        if (topic.schemaName && ALL_SUPPORTED_SCHEMAS.has(topic.schemaName)) {
          const mappedKey = settingsKeys.forTopic(topic.name, topic.schemaName);
          acc[mappedKey] = value;
        } else if (convertibleSchema) {
          const mappedKey = settingsKeys.forTopic(topic.name, convertibleSchema);
          acc[mappedKey] = value;
        } else {
          acc[key] = value;
        }
      } else {
        acc[key] = value;
      }
    },
    {} as RendererConfigV2["topics"],
  );

  return { ...sclone(oldConfig), version: "2", topics: mappedTopics };
}
