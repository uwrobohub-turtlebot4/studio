// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  Add,
  AppsAddIn,
  BarcodeScanner,
  BookStar,
  BracesVariable,
  Dismiss,
  DismissCircle,
  Document,
  DocumentLink,
  Edit,
  Flow,
  Settings,
  SlideAdd,
  TextBulletListTree,
} from "@emotion-icons/fluentui-system-regular";

import BlockheadFilledIcon from "@foxglove/studio-base/components/BlockheadFilledIcon";
import BlockheadIcon from "@foxglove/studio-base/components/BlockheadIcon";
import RosIcon from "@foxglove/studio-base/components/RosIcon";
import { RegisteredIconNames } from "@foxglove/studio-base/types/Icons";

import DatabaseSettings from "../assets/database-settings.svg";
import Delete from "../assets/delete.svg";
import PanelLayout from "../assets/panel-layout.svg";
import PanelSettings from "../assets/panel-settings.svg";

const icons: {
  // This makes it a type error to forget to add an icon here once it has been added to RegisteredIconNames.
  [N in RegisteredIconNames]: React.ReactElement;
} = {
  Add: <Add />,
  AddIn: <AppsAddIn />,
  BacklogList: <TextBulletListTree />,
  Blockhead: <BlockheadIcon />,
  BlockheadFilled: <BlockheadFilledIcon />,
  BookStar: <BookStar />,
  Cancel: <Dismiss />,
  DatabaseSettings: <DatabaseSettings />,
  Delete: <Delete />,
  Edit: <Edit />,
  ErrorBadge: <DismissCircle />,
  FileASPX: <DocumentLink />,
  FiveTileGrid: <PanelLayout />,
  Flow: <Flow />,
  GenericScan: <BarcodeScanner />,
  OpenFile: <Document />,
  PanelSettings: <PanelSettings />,
  RectangularClipping: <SlideAdd />,
  Settings: <Settings />,
  Variable2: <BracesVariable />,
  ROS: <RosIcon />,
};

export default icons;
