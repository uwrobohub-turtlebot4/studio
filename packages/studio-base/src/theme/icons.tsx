// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  AddCircle24Filled,
  Add24Regular,
  AppsAddIn24Regular,
  BarcodeScanner24Regular,
  BookStar24Regular,
  BracesVariable24Regular,
  Delete24Regular,
  Dismiss24Regular,
  DismissCircle24Regular,
  Document24Regular,
  DocumentLink24Regular,
  Edit24Regular,
  Flow16Regular,
  GridDots24Filled,
  Settings20Regular,
  SlideAdd24Regular,
  TextBulletListLtr24Regular,
} from "@fluentui/react-icons";
import Clock from "@mui/icons-material/AccessTime";
// import Add from "@mui/icons-material/Add";
import AddChart from "@mui/icons-material/Addchart";
import Points from "@mui/icons-material/BlurOn";
import Check from "@mui/icons-material/Check";
import Circle from "@mui/icons-material/Circle";
import Clear from "@mui/icons-material/Clear";
// import Delete from "@mui/icons-material/Delete";
import Walk from "@mui/icons-material/DirectionsWalk";
import Flag from "@mui/icons-material/Flag";
import Folder from "@mui/icons-material/Folder";
import FolderOpen from "@mui/icons-material/FolderOpen";
import Grid from "@mui/icons-material/GridOn";
import Hive from "@mui/icons-material/HiveOutlined";
import Shapes from "@mui/icons-material/Interests";
import World from "@mui/icons-material/Language";
import Background from "@mui/icons-material/Layers";
import Map from "@mui/icons-material/Map";
import MoveDown from "@mui/icons-material/MoveDown";
import MoveUp from "@mui/icons-material/MoveUp";
import NorthWest from "@mui/icons-material/NorthWest";
import NoteFilled from "@mui/icons-material/Note";
import Note from "@mui/icons-material/NoteOutlined";
import Move from "@mui/icons-material/OpenWith";
import Camera from "@mui/icons-material/PhotoCamera";
import PrecisionManufacturing from "@mui/icons-material/PrecisionManufacturing";
import Radar from "@mui/icons-material/Radar";
// import Settings from "@mui/icons-material/Settings";
import Share from "@mui/icons-material/Share";
import SouthEast from "@mui/icons-material/SouthEast";
import Star from "@mui/icons-material/StarOutline";
import Timeline from "@mui/icons-material/Timeline";
import Topic from "@mui/icons-material/Topic";
import Collapse from "@mui/icons-material/UnfoldLess";
import Expand from "@mui/icons-material/UnfoldMore";
import Cells from "@mui/icons-material/ViewComfy";
import Cube from "@mui/icons-material/ViewInAr";
import ImageProjection from "@mui/icons-material/Vrpano";

import BlockheadFilledIcon from "@foxglove/studio-base/components/BlockheadFilledIcon";
import BlockheadIcon from "@foxglove/studio-base/components/BlockheadIcon";
import { RegisteredIconNames } from "@foxglove/studio-base/types/Icons";

import DatabaseSettings from "../assets/database-settings.svg";
import PanelLayout from "../assets/panel-layout.svg";
import PanelSettings from "../assets/panel-settings.svg";

const icons: {
  // This makes it a type error to forget to add an icon here once it has been added to RegisteredIconNames.
  [N in RegisteredIconNames]: React.ReactElement;
} = {
  Add: <Add24Regular />,
  AddCircle: <AddCircle24Filled />,
  AddIn: <AppsAddIn24Regular />,
  BacklogList: <TextBulletListLtr24Regular />,
  Blockhead: <BlockheadIcon />,
  BlockheadFilled: <BlockheadFilledIcon />,
  BookStar: <BookStar24Regular />,
  Cancel: <Dismiss24Regular />,
  DatabaseSettings: <DatabaseSettings />,
  Delete: <Delete24Regular />,
  Edit: <Edit24Regular />,
  ErrorBadge: <DismissCircle24Regular />,
  FileASPX: <DocumentLink24Regular />,
  FiveTileGrid: <PanelLayout />,
  Flow: <Flow16Regular />,
  GenericScan: <BarcodeScanner24Regular />,
  OpenFile: <Document24Regular />,
  PanelSettings: <PanelSettings />,
  RectangularClipping: <SlideAdd24Regular />,
  Settings: <Settings20Regular />,
  Variable2: <BracesVariable24Regular />,
  ROS: <GridDots24Filled />,
  AddChart: <AddChart />,
  Background: <Background />,
  Camera: <Camera />,
  Cells: <Cells />,
  Check: <Check />,
  Circle: <Circle />,
  Clear: <Clear />,
  Clock: <Clock />,
  Collapse: <Collapse />,
  Cube: <Cube />,
  Expand: <Expand />,
  Flag: <Flag />,
  Folder: <Folder />,
  FolderOpen: <FolderOpen />,
  Grid: <Grid />,
  Hive: <Hive />,
  ImageProjection: <ImageProjection />,
  Map: <Map />,
  Move: <Move />,
  MoveDown: <MoveDown />,
  MoveUp: <MoveUp />,
  NorthWest: <NorthWest />,
  Note: <Note />,
  NoteFilled: <NoteFilled />,
  Points: <Points />,
  PrecisionManufacturing: <PrecisionManufacturing />,
  Radar: <Radar />,
  Shapes: <Shapes />,
  Share: <Share />,
  SouthEast: <SouthEast />,
  Star: <Star />,
  Timeline: <Timeline />,
  Topic: <Topic />,
  Walk: <Walk />,
  World: <World />,
};

export default icons;
