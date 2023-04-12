// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as IDB from "idb/with-async-ittr";

import { LayoutData } from "@foxglove/studio-base/context/CurrentLayoutContext/actions";

const DATABASE_NAME = "foxglove-core";
const OBJECT_STORE_NAME = "layouts";

interface LayoutsDB extends IDB.DBSchema {
  layouts: {
    key: string;
    value: LayoutData;
  };
}

export class IdbLayoutStorage {
  private _db = IDB.openDB<LayoutsDB>(DATABASE_NAME, 1, {
    upgrade(db) {
      db.createObjectStore(OBJECT_STORE_NAME);
    },
  });

  public async get(): Promise<LayoutData | undefined> {
    const db = await this._db;
    return await db.get(OBJECT_STORE_NAME, "workspace-layout");
  }

  public async put(layout: LayoutData): Promise<LayoutData> {
    const db = await this._db;
    await db.put(OBJECT_STORE_NAME, layout, "workspace-layout");
    return layout;
  }
}
