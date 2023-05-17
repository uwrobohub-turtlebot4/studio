// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { StoryObj } from "@storybook/react";
import { cloneDeep } from "lodash";
import { useEffect, useState } from "react";

import { ImageAnnotations, PointsAnnotationType } from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";
import { ImageModeConfig } from "@foxglove/studio-base/panels/ThreeDeeRender/IRenderer";
import { makeImageAndCalibration } from "@foxglove/studio-base/panels/ThreeDeeRender/stories/ImageMode/imageCommon";
import PanelSetup, { Fixture } from "@foxglove/studio-base/stories/PanelSetup";
import { useReadySignal } from "@foxglove/studio-base/stories/ReadySignalContext";

import { ImagePanel } from "../../index";

export default {
  title: "panels/ThreeDeeRender/Images/Annotations",
  component: ImagePanel,
};

const AnnotationsStory = (imageModeConfigOverride: Partial<ImageModeConfig> = {}): JSX.Element => {
  const width = 60;
  const height = 45;
  const { calibrationMessage, cameraMessage } = makeImageAndCalibration({
    width,
    height,
    frameId: "camera",
    imageTopic: "camera",
    calibrationTopic: "calibration",
  });

  const annotationsMessage: MessageEvent<Partial<ImageAnnotations>> = {
    topic: "annotations",
    receiveTime: { sec: 10, nsec: 0 },
    message: {
      circles: [
        {
          timestamp: { sec: 0, nsec: 0 },
          position: { x: 20, y: 5 },
          diameter: 4,
          thickness: 1,
          fill_color: { r: 1, g: 0, b: 1, a: 1 },
          outline_color: { r: 1, g: 1, b: 0, a: 1 },
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          position: { x: 25, y: 5 },
          diameter: 4,
          thickness: 1,
          fill_color: { r: 1, g: 0, b: 1, a: 0.5 },
          outline_color: { r: 0, g: 0, b: 0, a: 0 },
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          position: { x: 30, y: 5 },
          diameter: 4,
          thickness: 0.5,
          fill_color: { r: 1, g: 1, b: 0, a: 0 },
          outline_color: { r: 0, g: 1, b: 1, a: 0.5 },
        },
      ],
      points: [
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.POINTS,
          points: [
            { x: 0, y: 0 },
            { x: 0, y: 8 },
            { x: 2, y: 6 },
            { x: 5, y: 2 },
          ],
          outline_color: { r: 1, g: 0, b: 0, a: 1 },
          outline_colors: [],
          fill_color: { r: 0, g: 0, b: 0, a: 0 },
          thickness: 1,
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.POINTS,
          points: [
            { x: 10 + 0, y: 0 },
            { x: 10 + 0, y: 8 },
            { x: 10 + 2, y: 6 },
            { x: 10 + 5, y: 2 },
          ],
          outline_color: { r: 0, g: 0, b: 0, a: 1 },
          outline_colors: [
            { r: 1, g: 0, b: 0, a: 1 },
            { r: 0, g: 1, b: 0, a: 1 },
            { r: 0, g: 0, b: 1, a: 1 },
            { r: 0, g: 1, b: 1, a: 1 },
          ],
          fill_color: { r: 0, g: 0, b: 0, a: 0 },
          thickness: 2,
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.LINE_LIST,
          points: [
            { x: 0, y: 10 + 0 },
            { x: 0, y: 10 + 8 },
            { x: 2, y: 10 + 6 },
            { x: 5, y: 10 + 2 },
          ],
          outline_color: { r: 1, g: 0, b: 0, a: 1 },
          outline_colors: [],
          fill_color: { r: 0, g: 0, b: 0, a: 0 },
          thickness: 1,
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.LINE_LIST,
          points: [
            { x: 10 + 0, y: 10 + 0 },
            { x: 10 + 0, y: 10 + 8 },
            { x: 10 + 2, y: 10 + 6 },
            { x: 10 + 5, y: 10 + 2 },
          ],
          outline_color: { r: 0, g: 0, b: 0, a: 1 },
          outline_colors: [
            // 1 color per point
            { r: 1, g: 0, b: 0, a: 1 },
            { r: 0, g: 1, b: 0, a: 1 },
            { r: 0, g: 0, b: 1, a: 1 },
            { r: 0, g: 1, b: 1, a: 1 },
          ],
          fill_color: { r: 0, g: 0, b: 0, a: 0 },
          thickness: 2,
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.LINE_LIST,
          points: [
            { x: 20 + 0, y: 10 + 0 },
            { x: 20 + 0, y: 10 + 8 },
            { x: 20 + 2, y: 10 + 6 },
            { x: 20 + 5, y: 10 + 2 },
          ],
          outline_color: { r: 0, g: 0, b: 0, a: 1 },
          outline_colors: [
            // 1 color per line
            { r: 1, g: 0, b: 0, a: 1 },
            { r: 0, g: 1, b: 0, a: 1 },
          ],
          fill_color: { r: 0, g: 0, b: 0, a: 0 },
          thickness: 2,
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.LINE_STRIP,
          points: [
            { x: 0, y: 20 + 0 },
            { x: 0, y: 20 + 8 },
            { x: 2, y: 20 + 6 },
            { x: 5, y: 20 + 2 },
          ],
          outline_color: { r: 1, g: 0, b: 0, a: 1 },
          outline_colors: [],
          fill_color: { r: 0, g: 0, b: 0, a: 0 },
          thickness: 1,
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.LINE_STRIP,
          points: [
            { x: 10 + 0, y: 20 + 0 },
            { x: 10 + 0, y: 20 + 8 },
            { x: 10 + 2, y: 20 + 6 },
            { x: 10 + 5, y: 20 + 2 },
          ],
          outline_color: { r: 1, g: 1, b: 0, a: 1 },
          outline_colors: [],
          fill_color: { r: 1, g: 0, b: 1, a: 1 },
          thickness: 0.5,
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.LINE_LOOP,
          points: [
            { x: 0, y: 30 + 0 },
            { x: 0, y: 30 + 8 },
            { x: 2, y: 30 + 6 },
            { x: 5, y: 30 + 2 },
          ],
          outline_color: { r: 1, g: 0, b: 0, a: 1 },
          outline_colors: [],
          fill_color: { r: 0, g: 0, b: 0, a: 0 },
          thickness: 1,
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.LINE_LOOP,
          points: [
            { x: 10 + 0, y: 30 + 0 },
            { x: 10 + 0, y: 30 + 8 },
            { x: 10 + 2, y: 30 + 6 },
            { x: 10 + 5, y: 30 + 2 },
          ],
          outline_color: { r: 1, g: 1, b: 0, a: 1 },
          outline_colors: [],
          fill_color: { r: 1, g: 0, b: 1, a: 1 },
          thickness: 0.5,
        },
      ],
      texts: [
        {
          timestamp: { sec: 0, nsec: 0 },
          position: { x: 20, y: 30 },
          text: "Hi",
          font_size: 5,
          text_color: { r: 1, g: 0, b: 0, a: 1 },
          background_color: { r: 1, g: 1, b: 0, a: 1 },
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          position: { x: 20, y: 32 },
          text: "hello",
          font_size: 3,
          text_color: { r: 0.3, g: 0.5, b: 0.5, a: 0.8 },
          background_color: { r: 1, g: 1, b: 1, a: 0.2 },
        },
      ],
    },
    schemaName: "foxglove.ImageAnnotations",
    sizeInBytes: 0,
  };

  const fixture: Fixture = {
    topics: [
      { name: "calibration", schemaName: "foxglove.CameraCalibration" },
      { name: "camera", schemaName: "foxglove.RawImage" },
      { name: "annotations", schemaName: "foxglove.ImageAnnotations" },
    ],
    frame: {
      calibration: [calibrationMessage],
      camera: [cameraMessage],
      annotations: [annotationsMessage],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
    },
  };
  return (
    <PanelSetup fixture={fixture}>
      <ImagePanel
        overrideConfig={{
          ...ImagePanel.defaultConfig,
          imageMode: {
            calibrationTopic: "calibration",
            imageTopic: "camera",
            annotations: [
              {
                topic: "annotations",
                schemaName: "foxglove.ImageAnnotations",
                settings: { visible: true },
              },
            ],
            ...imageModeConfigOverride,
          },
        }}
      />
    </PanelSetup>
  );
};

export const Annotations: StoryObj = {
  parameters: { colorScheme: "light" },
  render: AnnotationsStory,
};

export const AnnotationsWithoutCalibration: StoryObj = {
  parameters: { colorScheme: "light" },
  render: AnnotationsStory,
  args: { calibrationTopic: undefined },
};

export const MessageConverterSupport: StoryObj = {
  parameters: { colorScheme: "light" },
  render: function Story() {
    const width = 60;
    const height = 45;

    const { calibrationMessage, cameraMessage } = makeImageAndCalibration({
      width,
      height,
      frameId: "camera",
      imageTopic: "camera",
      calibrationTopic: "calibration",
    });

    const annotationsMessage: MessageEvent<Partial<ImageAnnotations>> = {
      topic: "annotations",
      receiveTime: { sec: 10, nsec: 0 },
      message: {
        points: [
          {
            timestamp: { sec: 0, nsec: 0 },
            type: PointsAnnotationType.POINTS,
            points: [
              { x: 10 + 0, y: 10 + 0 },
              { x: 10 + 0, y: 10 + 8 },
              { x: 10 + 2, y: 10 + 6 },
              { x: 10 + 5, y: 10 + 2 },
            ],
            outline_color: { r: 0, g: 0, b: 0, a: 1 },
            outline_colors: [
              { r: 1, g: 0, b: 0, a: 1 },
              { r: 0, g: 1, b: 0, a: 1 },
              { r: 0, g: 0, b: 1, a: 1 },
              { r: 0, g: 1, b: 1, a: 1 },
            ],
            fill_color: { r: 0, g: 0, b: 0, a: 0 },
            thickness: 1,
          },
        ],
      },
      schemaName: "foxglove.ImageAnnotations",
      sizeInBytes: 0,
    };

    const customAnnotationsMessage: MessageEvent<Partial<unknown>> = {
      topic: "custom_annotations",
      receiveTime: { sec: 10, nsec: 0 },
      message: { foo: "bar" },
      schemaName: "MyCustomSchema",
      sizeInBytes: 0,
    };

    const fixture: Fixture = {
      topics: [
        { name: "calibration", schemaName: "foxglove.CameraCalibration" },
        { name: "camera", schemaName: "foxglove.RawImage" },
        { name: "annotations", schemaName: "foxglove.ImageAnnotations" },
        { name: "custom_annotations", schemaName: "MyCustomSchema" },
      ],
      frame: {
        calibration: [calibrationMessage],
        camera: [cameraMessage],
        annotations: [annotationsMessage],
        custom_annotations: [customAnnotationsMessage],
      },
      capabilities: [],
      activeData: {
        currentTime: { sec: 0, nsec: 0 },
      },
      messageConverters: [
        // both original and converted schemas are supported
        {
          version: "1",
          fromSchemaName: "foxglove.ImageAnnotations",
          toSchemaName: "foxglove_msgs/ImageAnnotations",
          converter: (_msg): Partial<ImageAnnotations> => ({
            points: [
              {
                timestamp: { sec: 0, nsec: 0 },
                type: PointsAnnotationType.LINE_LOOP,
                points: [
                  { x: 20 + 0, y: 10 + 0 },
                  { x: 20 + 0, y: 10 + 8 },
                  { x: 20 + 2, y: 10 + 6 },
                  { x: 20 + 5, y: 10 + 2 },
                ],
                outline_color: { r: 1, g: 1, b: 0, a: 1 },
                outline_colors: [],
                fill_color: { r: 0, g: 1, b: 1, a: 0 },
                thickness: 1,
              },
            ],
          }),
        },
        // original schema is not supported, but two converters are supported
        {
          version: "1",
          fromSchemaName: "MyCustomSchema",
          toSchemaName: "foxglove_msgs/ImageAnnotations",
          converter: (_msg): Partial<ImageAnnotations> => ({
            points: [
              {
                timestamp: { sec: 0, nsec: 0 },
                type: PointsAnnotationType.LINE_LIST,
                points: [
                  { x: 30 + 0, y: 10 + 0 },
                  { x: 30 + 0, y: 10 + 8 },
                  { x: 30 + 2, y: 10 + 6 },
                  { x: 30 + 5, y: 10 + 2 },
                ],
                outline_color: { r: 0, g: 0, b: 0, a: 1 },
                outline_colors: [
                  // 1 color per point
                  { r: 1, g: 0, b: 0, a: 1 },
                  { r: 0, g: 1, b: 0, a: 1 },
                  { r: 0, g: 0, b: 1, a: 1 },
                  { r: 0, g: 1, b: 1, a: 1 },
                ],
                fill_color: { r: 0, g: 0, b: 0, a: 0 },
                thickness: 2,
              },
            ],
          }),
        },
        {
          version: "1",
          fromSchemaName: "MyCustomSchema",
          toSchemaName: "foxglove_msgs/msg/ImageAnnotations",
          converter: (_msg): Partial<ImageAnnotations> => ({
            points: [
              {
                timestamp: { sec: 0, nsec: 0 },
                type: PointsAnnotationType.LINE_STRIP,
                points: [
                  { x: 40 + 0, y: 10 + 0 },
                  { x: 40 + 0, y: 10 + 8 },
                  { x: 40 + 2, y: 10 + 6 },
                  { x: 40 + 5, y: 10 + 2 },
                ],
                outline_color: { r: 1, g: 1, b: 1, a: 1 },
                outline_colors: [],
                fill_color: { r: 0, g: 0, b: 0, a: 0 },
                thickness: 2,
              },
            ],
          }),
        },
        // unrelated converter should not be shown
        {
          version: "1",
          fromSchemaName: "MyCustomSchema",
          toSchemaName: "foxglove.SceneUpdate",
          converter: (msg) => msg,
        },
      ],
    };
    return (
      <PanelSetup fixture={fixture} includeSettings>
        <ImagePanel
          overrideConfig={{
            ...ImagePanel.defaultConfig,
            imageMode: {
              calibrationTopic: "calibration",
              imageTopic: "camera",
              annotations: [
                {
                  topic: "annotations",
                  schemaName: "foxglove.ImageAnnotations",
                  settings: { visible: true },
                },
                {
                  topic: "annotations",
                  schemaName: "foxglove_msgs/ImageAnnotations",
                  settings: { visible: true },
                },
                {
                  topic: "custom_annotations",
                  schemaName: "foxglove_msgs/ImageAnnotations",
                  settings: { visible: true },
                },
                {
                  topic: "custom_annotations",
                  schemaName: "foxglove_msgs/msg/ImageAnnotations",
                  settings: { visible: true },
                },
              ],
            },
          }}
        />
      </PanelSetup>
    );
  },
};

const AnnotationsUpdateStory = (
  imageModeConfigOverride: Partial<ImageModeConfig> = {},
): JSX.Element => {
  const readySignal = useReadySignal();
  const width = 60;
  const height = 45;
  const { calibrationMessage, cameraMessage } = makeImageAndCalibration({
    width,
    height,
    frameId: "camera",
    imageTopic: "camera",
    calibrationTopic: "calibration",
  });

  const annotationsMessage: MessageEvent<Partial<ImageAnnotations>> = {
    topic: "annotations",
    receiveTime: { sec: 0, nsec: 0 },
    message: {
      circles: [
        {
          timestamp: { sec: 0, nsec: 0 },
          position: { x: 20, y: 5 },
          diameter: 4,
          thickness: 1,
          fill_color: { r: 1, g: 0, b: 1, a: 1 },
          outline_color: { r: 1, g: 1, b: 0, a: 1 },
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          position: { x: 25, y: 5 },
          diameter: 4,
          thickness: 1,
          fill_color: { r: 1, g: 0, b: 1, a: 0.5 },
          outline_color: { r: 0, g: 0, b: 0, a: 0 },
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          position: { x: 30, y: 5 },
          diameter: 4,
          thickness: 0.5,
          fill_color: { r: 1, g: 1, b: 0, a: 0 },
          outline_color: { r: 0, g: 1, b: 1, a: 0.5 },
        },
      ],
      points: [
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.POINTS,
          points: [
            { x: 0, y: 0 },
            { x: 0, y: 8 },
            { x: 2, y: 6 },
            { x: 5, y: 2 },
          ],
          outline_color: { r: 1, g: 0, b: 0, a: 1 },
          outline_colors: [],
          fill_color: { r: 0, g: 0, b: 0, a: 0 },
          thickness: 1,
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.POINTS,
          points: [
            { x: 10 + 0, y: 0 },
            { x: 10 + 0, y: 8 },
            { x: 10 + 2, y: 6 },
            { x: 10 + 5, y: 2 },
          ],
          outline_color: { r: 0, g: 0, b: 0, a: 1 },
          outline_colors: [
            { r: 1, g: 0, b: 0, a: 1 },
            { r: 0, g: 1, b: 0, a: 1 },
            { r: 0, g: 0, b: 1, a: 1 },
            { r: 0, g: 1, b: 1, a: 1 },
          ],
          fill_color: { r: 0, g: 0, b: 0, a: 0 },
          thickness: 2,
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.LINE_LIST,
          points: [
            { x: 0, y: 10 + 0 },
            { x: 0, y: 10 + 8 },
            { x: 2, y: 10 + 6 },
            { x: 5, y: 10 + 2 },
          ],
          outline_color: { r: 1, g: 0, b: 0, a: 1 },
          outline_colors: [],
          fill_color: { r: 0, g: 0, b: 0, a: 0 },
          thickness: 1,
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.LINE_LIST,
          points: [
            { x: 10 + 0, y: 10 + 0 },
            { x: 10 + 0, y: 10 + 8 },
            { x: 10 + 2, y: 10 + 6 },
            { x: 10 + 5, y: 10 + 2 },
          ],
          outline_color: { r: 0, g: 0, b: 0, a: 1 },
          outline_colors: [
            // 1 color per point
            { r: 1, g: 0, b: 0, a: 1 },
            { r: 0, g: 1, b: 0, a: 1 },
            { r: 0, g: 0, b: 1, a: 1 },
            { r: 0, g: 1, b: 1, a: 1 },
          ],
          fill_color: { r: 0, g: 0, b: 0, a: 0 },
          thickness: 2,
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.LINE_LIST,
          points: [
            { x: 20 + 0, y: 10 + 0 },
            { x: 20 + 0, y: 10 + 8 },
            { x: 20 + 2, y: 10 + 6 },
            { x: 20 + 5, y: 10 + 2 },
          ],
          outline_color: { r: 0, g: 0, b: 0, a: 1 },
          outline_colors: [
            // 1 color per line
            { r: 1, g: 0, b: 0, a: 1 },
            { r: 0, g: 1, b: 0, a: 1 },
          ],
          fill_color: { r: 0, g: 0, b: 0, a: 0 },
          thickness: 2,
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.LINE_STRIP,
          points: [
            { x: 0, y: 20 + 0 },
            { x: 0, y: 20 + 8 },
            { x: 2, y: 20 + 6 },
            { x: 5, y: 20 + 2 },
          ],
          outline_color: { r: 1, g: 0, b: 0, a: 1 },
          outline_colors: [],
          fill_color: { r: 0, g: 0, b: 0, a: 0 },
          thickness: 1,
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.LINE_STRIP,
          points: [
            { x: 10 + 0, y: 20 + 0 },
            { x: 10 + 0, y: 20 + 8 },
            { x: 10 + 2, y: 20 + 6 },
            { x: 10 + 5, y: 20 + 2 },
          ],
          outline_color: { r: 1, g: 1, b: 0, a: 1 },
          outline_colors: [],
          fill_color: { r: 1, g: 0, b: 1, a: 1 },
          thickness: 0.5,
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.LINE_LOOP,
          points: [
            { x: 0, y: 30 + 0 },
            { x: 0, y: 30 + 8 },
            { x: 2, y: 30 + 6 },
            { x: 5, y: 30 + 2 },
          ],
          outline_color: { r: 1, g: 0, b: 0, a: 1 },
          outline_colors: [],
          fill_color: { r: 0, g: 0, b: 0, a: 0 },
          thickness: 1,
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          type: PointsAnnotationType.LINE_LOOP,
          points: [
            { x: 10 + 0, y: 30 + 0 },
            { x: 10 + 0, y: 30 + 8 },
            { x: 10 + 2, y: 30 + 6 },
            { x: 10 + 5, y: 30 + 2 },
          ],
          outline_color: { r: 1, g: 1, b: 0, a: 1 },
          outline_colors: [],
          fill_color: { r: 1, g: 0, b: 1, a: 1 },
          thickness: 0.5,
        },
      ],
      texts: [
        {
          timestamp: { sec: 0, nsec: 0 },
          position: { x: 20, y: 30 },
          text: "Hi",
          font_size: 5,
          text_color: { r: 1, g: 0, b: 0, a: 1 },
          background_color: { r: 1, g: 1, b: 0, a: 1 },
        },
        {
          timestamp: { sec: 0, nsec: 0 },
          position: { x: 20, y: 32 },
          text: "hello",
          font_size: 3,
          text_color: { r: 0.3, g: 0.5, b: 0.5, a: 0.8 },
          background_color: { r: 1, g: 1, b: 1, a: 0.2 },
        },
      ],
    },
    schemaName: "foxglove.ImageAnnotations",
    sizeInBytes: 0,
  };

  const [fixture, setFixture] = useState({
    topics: [
      { name: "calibration", schemaName: "foxglove.CameraCalibration" },
      { name: "camera", schemaName: "foxglove.RawImage" },
      { name: "annotations", schemaName: "foxglove.ImageAnnotations" },
    ],
    frame: {
      calibration: [calibrationMessage],
      camera: [cameraMessage],
      annotations: [annotationsMessage],
    },
    capabilities: [],
    activeData: {
      currentTime: { sec: 0, nsec: 0 },
      isPlaying: true,
    },
  });

  useEffect(() => {
    const newAnnotations: MessageEvent<Partial<ImageAnnotations>> = {
      topic: "annotations",
      schemaName: "foxglove.ImageAnnotations",
      receiveTime: { sec: 1, nsec: 0 },
      message: moveAnnotations(annotationsMessage.message, { x: 5, y: 5 }),
      sizeInBytes: 0,
    };

    let timeOutID2: NodeJS.Timeout;

    const timeOutID = setTimeout(() => {
      setFixture((oldFixture) => {
        const newFixture = { ...oldFixture };
        newFixture.frame = {
          annotations: [newAnnotations],
          calibration: [],
          camera: [],
        };
        newFixture.activeData = {
          currentTime: { sec: 1, nsec: 0 },
          isPlaying: true,
        };
        return newFixture;
      });
      timeOutID2 = setTimeout(() => readySignal(), 100);
    }, 500);

    return () => {
      clearTimeout(timeOutID);
      clearTimeout(timeOutID2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readySignal]);

  return (
    <PanelSetup fixture={fixture}>
      <ImagePanel
        overrideConfig={{
          ...ImagePanel.defaultConfig,
          imageMode: {
            calibrationTopic: "calibration",
            imageTopic: "camera",
            annotations: [
              {
                topic: "annotations",
                schemaName: "foxglove.ImageAnnotations",
                settings: { visible: true },
              },
            ],
            ...imageModeConfigOverride,
          },
        }}
      />
    </PanelSetup>
  );
};

function moveAnnotations(annotation: Partial<ImageAnnotations>, vector: { x: number; y: number }) {
  const newAnnotation = cloneDeep(annotation);

  newAnnotation.circles?.forEach(({ position }) => {
    position.x += vector.x;
    position.y += vector.y;
  });

  newAnnotation.points?.forEach(({ points }) => {
    points.forEach((point) => {
      point.x += vector.x;
      point.y += vector.y;
    });
  });

  newAnnotation.texts?.forEach(({ position }) => {
    position.x += vector.x;
    position.y += vector.y;
  });

  return newAnnotation;
}

export const AnnotationsUpdate: StoryObj = {
  parameters: {
    colorScheme: "light",
    useReadySignal: true,
  },
  render: AnnotationsUpdateStory,

  play: async (ctx) => {
    await ctx.parameters.storyReady;
  },
};
