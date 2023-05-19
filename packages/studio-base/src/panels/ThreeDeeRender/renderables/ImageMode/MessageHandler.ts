// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { AVLTree } from "@foxglove/avl";
import { TwoKeyMap } from "@foxglove/den/collection";
import {
  Time,
  fromNanoSec,
  toNanoSec,
  compare as compareTime,
  isLessThan,
} from "@foxglove/rostime";
import { CompressedImage, RawImage } from "@foxglove/schemas";
import { ImageAnnotations as FoxgloveImageAnnotations } from "@foxglove/schemas";
import { MessageEvent } from "@foxglove/studio";
import { normalizeAnnotations } from "@foxglove/studio-base/panels/Image/lib/normalizeAnnotations";
import { Annotation } from "@foxglove/studio-base/panels/Image/types";
import { ImageAnnotationSubscription } from "@foxglove/studio-base/panels/ThreeDeeRender/IRenderer";
import { AnyImage } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/Images/ImageTypes";
import {
  normalizeCompressedImage,
  normalizeRawImage,
  normalizeRosCompressedImage,
  normalizeRosImage,
} from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/Images/imageNormalizers";
import { normalizeCameraInfo } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/projections";
import {
  ImageMarker as RosImageMarker,
  ImageMarkerArray as RosImageMarkerArray,
} from "@foxglove/studio-base/types/Messages";

import { PartialMessageEvent } from "../../SceneExtension";
import { CompressedImage as RosCompressedImage, Image as RosImage, CameraInfo } from "../../ros";

type MessageEventAnnotationsPair = {
  // required for setting the original message on the renderable
  messageEvent: MessageEvent<RosImageMarkerArray | RosImageMarker | FoxgloveImageAnnotations>;
  annotations: Annotation[];
};

type SynchronizationItem = {
  image?: PartialMessageEvent<AnyImage>;
  annotationsByTopicSchema: TwoKeyMap<string, string, MessageEventAnnotationsPair>;
};

type ImageModeConfig = {
  imageTopic: string | undefined;
  calibrationTopic: string | undefined;
  annotationSubscriptions: readonly ImageAnnotationSubscription[];
  synchronize: boolean;
};

export type MessageHandlerState = {
  image?: PartialMessageEvent<AnyImage>;
  cameraInfo?: CameraInfo;
  annotationsByTopicSchema: TwoKeyMap<string, string, MessageEventAnnotationsPair>;
};

export class MessageHandler {
  #config: ImageModeConfig;
  #oldState: Partial<MessageHandlerState> | undefined;
  #state: MessageHandlerState;
  #tree: AVLTree<Time, SynchronizationItem>;
  #listeners: ((
    newState: Partial<MessageHandlerState>,
    oldState: Partial<MessageHandlerState> | undefined,
  ) => void)[] = [];

  public constructor(config: ImageModeConfig) {
    this.#config = {
      ...config,
    };
    this.#state = {
      annotationsByTopicSchema: new TwoKeyMap(),
    };
    this.#tree = new AVLTree<Time, SynchronizationItem>(compareTime);
  }
  public addListener(
    listener: (
      newState: Partial<MessageHandlerState>,
      oldState: Partial<MessageHandlerState> | undefined,
    ) => void,
  ): void {
    this.#listeners.push(listener);
  }

  public removeListener(
    listener: (
      newState: Partial<MessageHandlerState>,
      oldState: Partial<MessageHandlerState> | undefined,
    ) => void,
  ): void {
    this.#listeners.filter((fn) => fn !== listener);
  }

  public handleRosRawImage = (messageEvent: PartialMessageEvent<RosImage>): void => {
    this.#handleImage(messageEvent, normalizeRosImage(messageEvent.message));
  };

  public handleRosCompressedImage = (
    messageEvent: PartialMessageEvent<RosCompressedImage>,
  ): void => {
    this.#handleImage(messageEvent, normalizeRosCompressedImage(messageEvent.message));
  };

  public handleRawImage = (messageEvent: PartialMessageEvent<RawImage>): void => {
    this.#handleImage(messageEvent, normalizeRawImage(messageEvent.message));
  };

  public handleCompressedImage = (messageEvent: PartialMessageEvent<CompressedImage>): void => {
    this.#handleImage(messageEvent, normalizeCompressedImage(messageEvent.message));
  };

  #handleImage(message: PartialMessageEvent<AnyImage>, image: AnyImage) {
    const normalizedImageMessage = {
      ...message,
      message: image,
    };
    this.#state.image = normalizedImageMessage;

    if (!this.#config.synchronize) {
      this.#emitState();
      return;
    }
    // Update the image at the stamp time
    const item = this.#tree.get(getTimestampFromImage(image));
    if (item) {
      item.image = normalizedImageMessage;
    } else {
      this.#tree.set(getTimestampFromImage(image), {
        image: normalizedImageMessage,
        annotationsByTopicSchema: new TwoKeyMap(),
      });
    }
    this.#emitState();
  }

  public handleCameraInfo = (message: PartialMessageEvent<CameraInfo>): void => {
    const cameraInfo = normalizeCameraInfo(message.message);
    this.#state.cameraInfo = cameraInfo;
    this.#emitState();
  };

  public handleAnnotations = (
    messageEvent: MessageEvent<FoxgloveImageAnnotations | RosImageMarker | RosImageMarkerArray>,
  ): void => {
    const annotations = normalizeAnnotations(messageEvent.message, messageEvent.schemaName);

    if (!annotations) {
      return;
    }

    const { topic, schemaName } = messageEvent;
    if (this.#config.synchronize) {
      const groups = new Map<bigint, Annotation[]>();

      for (const annotation of annotations) {
        const key = toNanoSec(annotation.stamp);
        const arr = groups.get(key);
        if (arr) {
          arr.push(annotation);
        } else {
          groups.set(key, [annotation]);
        }
      }

      for (const [stampNsec, group] of groups) {
        const stamp = fromNanoSec(stampNsec);
        let item = this.#tree.get(stamp);
        if (!item) {
          item = {
            image: undefined,
            annotationsByTopicSchema: new TwoKeyMap(),
          };
          this.#tree.set(stamp, item);
        }
        item.annotationsByTopicSchema.set(topic, schemaName, { messageEvent, annotations: group });
      }
    } else {
      this.#state.annotationsByTopicSchema.set(topic, schemaName, { messageEvent, annotations });
    }

    this.#emitState();
  };

  public setConfig(newConfig: Partial<ImageModeConfig>): void {
    let changed = false;

    if (newConfig.synchronize != undefined && newConfig.synchronize !== this.#config.synchronize) {
      changed = true;
    }

    if (this.#config.imageTopic !== newConfig.imageTopic) {
      this.#state.image = undefined;
      changed = true;
    }

    if (this.#config.calibrationTopic !== newConfig.calibrationTopic) {
      this.#state.cameraInfo = undefined;
      changed = true;
    }

    if (
      newConfig.annotationSubscriptions != undefined &&
      this.#config.annotationSubscriptions !== newConfig.annotationSubscriptions
    ) {
      for (const { topic, schemaName } of this.#config.annotationSubscriptions) {
        const newSubsHasOldSub = newConfig.annotationSubscriptions.find(
          ({ topic: newTopic, schemaName: newSchemaName }) =>
            topic === newTopic && schemaName === newSchemaName,
        );
        if (!newSubsHasOldSub) {
          this.#state.annotationsByTopicSchema.delete(topic, schemaName);
          changed = true;
        }
      }
    }

    this.#config = {
      ...this.#config,
      ...newConfig,
    };

    if (changed) {
      this.#emitState();
    }
  }

  public clear(): void {
    this.#state = {
      annotationsByTopicSchema: new TwoKeyMap(),
    };
    this.#tree.clear();
    this.#oldState = undefined;
  }

  #emitState() {
    const state = this.#getState();
    this.#listeners.forEach((fn) => fn(state, this.#oldState));
    this.#oldState = { ...state };
  }

  #getState(): Partial<MessageHandlerState> {
    if (this.#config.synchronize) {
      const validEntry = findSynchronizedSetAndRemoveOlderItems(
        this.#tree,
        this.#numVisibleAnnotations(),
      );
      if (validEntry) {
        return {
          cameraInfo: this.#state.cameraInfo,
          image: validEntry[1].image,
          annotationsByTopicSchema: validEntry[1].annotationsByTopicSchema,
        };
      }
      return {
        cameraInfo: this.#state.cameraInfo,
      };
    }
    return {
      cameraInfo: this.#state.cameraInfo,
      image: this.#state.image,
      annotationsByTopicSchema: this.#state.annotationsByTopicSchema,
    };
  }

  #numVisibleAnnotations(): number {
    return this.#config.annotationSubscriptions.filter(({ settings }) => settings.visible).length;
  }
}

/** Find the newest entry where we have everything synchronized */
function findSynchronizedSetAndRemoveOlderItems(
  tree: AVLTree<Time, SynchronizationItem>,
  numActiveAnnotationSubscriptions: number,
): [Time, SynchronizationItem] | undefined {
  let validEntry: [Time, SynchronizationItem] | undefined = undefined;
  for (const entry of tree.entries()) {
    const messageState = entry[1];
    // If we have an image and all the messages for annotation topics then we have a synchronized set.
    if (
      messageState.image &&
      messageState.annotationsByTopicSchema.size() === numActiveAnnotationSubscriptions
    ) {
      validEntry = entry;
    }
  }

  if (validEntry) {
    // We've got a set of synchronized messages, remove any older items from the tree
    let minKey = tree.minKey();
    while (minKey && isLessThan(minKey, validEntry[0])) {
      tree.shift();
      minKey = tree.minKey();
    }
  }

  return validEntry;
}

function getTimestampFromImage(image: AnyImage) {
  if ("header" in image) {
    return image.header.stamp;
  } else {
    return image.timestamp;
  }
}
