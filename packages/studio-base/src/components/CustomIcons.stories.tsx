// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Box } from "@mui/material";
import { storiesOf } from "@storybook/react";

import BlockheadFilledIcon from "@foxglove/studio-base/components/BlockheadFilledIcon";
import BlockheadIcon from "@foxglove/studio-base/components/BlockheadIcon";
import EyeClosedIcon from "@foxglove/studio-base/components/EyeClosedIcon";
import EyeOpenIcon from "@foxglove/studio-base/components/EyeOpenIcon";
import LoopIcon from "@foxglove/studio-base/components/LoopIcon";
import PublishGoalIcon from "@foxglove/studio-base/components/PublishGoalIcon";
import PublishPointIcon from "@foxglove/studio-base/components/PublishPointIcon";
import PublishPoseEstimateIcon from "@foxglove/studio-base/components/PublishPoseEstimateIcon";
import RosIcon from "@foxglove/studio-base/components/RosIcon";
import Stack from "@foxglove/studio-base/components/Stack";

storiesOf("components/CustomIcons", module)
  .add("Default", () => (
    <Stack direction="row" gap={1} padding={2}>
      <RosIcon />
      <LoopIcon />
      <BlockheadIcon />
      <BlockheadFilledIcon />
      <EyeOpenIcon />
      <EyeClosedIcon />
      <PublishGoalIcon />
      <PublishPointIcon />
      <PublishPoseEstimateIcon />
    </Stack>
  ))
  .add("Color", () => (
    <Box color="primary.main">
      <Stack direction="row" gap={1} padding={2}>
        <RosIcon color="inherit" />
        <LoopIcon color="inherit" />
        <BlockheadIcon color="inherit" />
        <BlockheadFilledIcon color="inherit" />
        <EyeOpenIcon color="inherit" />
        <EyeClosedIcon color="inherit" />
        <PublishGoalIcon color="inherit" />
        <PublishPointIcon color="inherit" />
        <PublishPoseEstimateIcon color="inherit" />
      </Stack>
    </Box>
  ));
