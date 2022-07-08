// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { downloadFiles } from "@foxglove/studio-base/util/download";

/**
 * A wrapper around window.showSaveFilePicker that saves a given blob, falling
 * back to saving directly to a file if the API isn't available (unsupported
 * browser or insecure context).
 */
export default async function saveFile(
  fileProducer: (fileName: string) => Promise<Blob>,
  fallbackFileName: string,
  options?: SaveFilePickerOptions,
): Promise<void> {
  let file: FileSystemFileHandle | undefined;
  try {
    file = await window.showSaveFilePicker(options);
  } catch (err) {
    if (err.name === "AbortError") {
      return;
    }
  }

  if (file) {
    const blob = await fileProducer(file.name);
    const stream = await file.createWritable({ keepExistingData: false });
    await stream.write(blob);
    await stream.close();
  } else {
    const blob = await fileProducer(fallbackFileName);
    downloadFiles([{ blob, fileName: fallbackFileName }]);
  }
}
