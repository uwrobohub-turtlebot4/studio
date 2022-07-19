// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import {
  IconButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  styled as muiStyled,
} from "@mui/material";
import { useCallback, useRef, useState } from "react";
import { useLongPress } from "react-use";

import PublishGoalIcon from "@foxglove/studio-base/components/PublishGoalIcon";
import PublishPointIcon from "@foxglove/studio-base/components/PublishPointIcon";
import PublishPoseEstimateIcon from "@foxglove/studio-base/components/PublishPoseEstimateIcon";
import { PublishClickType } from "@foxglove/studio-base/panels/ThreeDeeRender/renderables/PublishClickTool";

const PublishClickIcons: Record<PublishClickType, React.ReactNode> = {
  pose: <PublishGoalIcon fontSize="inherit" />,
  point: <PublishPointIcon fontSize="inherit" />,
  pose_estimate: <PublishPoseEstimateIcon fontSize="inherit" />,
};

const StyledIconButton = muiStyled(IconButton)(({ theme }) => ({
  pointerEvents: "auto",
  fontSize: "1rem",

  "&:after": {
    content: "''",
    borderBottom: "6px solid currentColor",
    borderRight: "6px solid transparent",
    bottom: 0,
    left: 0,
    height: 0,
    width: 0,
    margin: theme.spacing(0.25),
    position: "absolute",
  },
}));

export default function PublishTool(props: {
  publishActive: boolean;
  publishClickType: PublishClickType;
  onChangePublishClickType: (_: PublishClickType) => void;
  onClickPublish: () => void;
}): JSX.Element {
  const publickClickButtonRef = useRef<HTMLButtonElement>(ReactNull);
  const [publishMenuExpanded, setPublishMenuExpanded] = useState(false);
  const selectedPublishClickIcon = PublishClickIcons[props.publishClickType];

  const onLongPressPublish = useCallback(() => {
    setPublishMenuExpanded(true);
  }, []);
  const longPressPublishEvent = useLongPress(onLongPressPublish);

  return (
    <>
      <StyledIconButton
        {...longPressPublishEvent}
        color={props.publishActive ? "info" : "inherit"}
        title={props.publishActive ? "Click to cancel" : "Click to publish"}
        ref={publickClickButtonRef}
        onClick={props.onClickPublish}
        data-test="publish-button"
        id="publish-button"
        aria-controls={publishMenuExpanded ? "publish-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={publishMenuExpanded ? "true" : undefined}
      >
        {selectedPublishClickIcon}
      </StyledIconButton>
      <Menu
        id="publish-menu"
        anchorEl={publickClickButtonRef.current}
        anchorOrigin={{ vertical: "top", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "right" }}
        open={publishMenuExpanded}
        onClose={() => setPublishMenuExpanded(false)}
        MenuListProps={{
          "aria-labelledby": "publish-button",
          dense: true,
        }}
      >
        <MenuItem
          selected={props.publishClickType === "pose_estimate"}
          onClick={() => {
            props.onChangePublishClickType("pose_estimate");
            setPublishMenuExpanded(false);
          }}
        >
          <ListItemIcon>{PublishClickIcons.pose_estimate}</ListItemIcon>
          <ListItemText>Publish pose estimate</ListItemText>
        </MenuItem>
        <MenuItem
          selected={props.publishClickType === "pose"}
          onClick={() => {
            props.onChangePublishClickType("pose");
            setPublishMenuExpanded(false);
          }}
        >
          <ListItemIcon>{PublishClickIcons.pose}</ListItemIcon>
          <ListItemText>Publish pose</ListItemText>
        </MenuItem>
        <MenuItem
          selected={props.publishClickType === "point"}
          onClick={() => {
            props.onChangePublishClickType("point");
            setPublishMenuExpanded(false);
          }}
        >
          <ListItemIcon>{PublishClickIcons.point}</ListItemIcon>
          <ListItemText>Publish point</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
