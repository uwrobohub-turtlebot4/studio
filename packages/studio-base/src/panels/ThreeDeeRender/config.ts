// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Immutable } from "immer";
import { DeepPartial, DeepWritable } from "ts-essentials";

import { FollowMode, ImageModeConfig } from "@foxglove/studio-base/panels/ThreeDeeRender/IRenderer";
import { MeshUpAxis } from "@foxglove/studio-base/panels/ThreeDeeRender/ModelCache";
import { CameraState } from "@foxglove/studio-base/panels/ThreeDeeRender/camera";
import { LayerSettingsTransform } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/FrameAxes";
import { PublishClickType } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/PublishClickTool";
import {
  BaseSettings,
  CustomLayerSettings,
} from "@foxglove/studio-base/panels/ThreeDeeRender/settings";

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

type RendererConfigV2 = Omit<RendererConfigV1, "topics"> & {
  version: "2";
  topics: Record<string, Record<string, Partial<BaseSettings>>>;
};

export type AnyRendererConfig = RendererConfigV1 | RendererConfigV2;
export type RendererConfig = RendererConfigV2;

function sclone<T>(val: T): DeepWritable<T> {
  return structuredClone(val) as DeepWritable<T>;
}

export function migrateConfig(
  oldConfig: Immutable<DeepPartial<RendererConfigV1 | RendererConfigV2>>,
): DeepPartial<RendererConfig> {
  if ("version" in oldConfig) {
    return sclone(oldConfig);
  }
  const topics = {};
  return { ...sclone(oldConfig), version: "2", topics };
}
