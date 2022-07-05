// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/
//
// This file incorporates work covered by the following copyright and
// permission notice:
//
//   Copyright 2018-2021 Cruise LLC
//
//   This source code is licensed under the Apache License, Version 2.0,
//   found at http://www.apache.org/licenses/LICENSE-2.0
//   You may not use this file except in compliance with the License.

import AddLinkIcon from "@mui/icons-material/AddLink";
import {
  Button,
  FilledInput,
  IconButton,
  Menu,
  Typography,
  styled as muiStyled,
} from "@mui/material";
import { FormEvent, useState } from "react";

import Stack from "@foxglove/studio-base/components/Stack";

import GlobalVariableName from "../GlobalVariableName";
import useLinkedGlobalVariables from "../useLinkedGlobalVariables";
import UnlinkGlobalVariables from "./UnlinkGlobalVariables";

const StyledIconButton = muiStyled(IconButton, {
  shouldForwardProp: (prop) => prop !== "active",
})<{
  active?: boolean;
}>(({ active = false, theme }) => ({
  padding: 0,
  opacity: active ? 0 : theme.palette.action.disabledOpacity,

  "&:hover": {
    backgroundColor: "transparent",
    opacity: 1,
  },
}));

type AddToLinkedGlobalVariable = {
  topic: string;
  markerKeyPath: string[];
  variableValue: unknown;
};

type Props = {
  highlight?: boolean;
  addToLinkedGlobalVariable: AddToLinkedGlobalVariable;
};

function getInitialName(markerKeyPath: string[]) {
  return markerKeyPath.slice(0, 2).reverse().join("_");
}

export default function LinkToGlobalVariable({
  addToLinkedGlobalVariable: { topic, variableValue, markerKeyPath },
  highlight = false,
}: Props): JSX.Element {
  const [name, setName] = useState<string>(() => getInitialName(markerKeyPath));
  const [anchorEl, setAnchorEl] = useState<undefined | HTMLElement>(undefined);
  const open = Boolean(anchorEl);

  const { linkedGlobalVariables, setLinkedGlobalVariables } = useLinkedGlobalVariables();

  const addLink = (ev: FormEvent) => {
    ev.preventDefault();
    void variableValue;
    // setGlobalVariables({ [name]: variableValue });
    const newLinkedGlobalVariables = [...linkedGlobalVariables, { topic, markerKeyPath, name }];
    setLinkedGlobalVariables(newLinkedGlobalVariables);
    handleClose();
  };

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = () => {
    setAnchorEl(undefined);
  };

  return (
    <>
      <StyledIconButton
        color="info"
        size="small"
        id="link-global-variable-button"
        aria-controls={open ? "link-global-variable-menu" : undefined}
        aria-haspopup="true"
        aria-expanded={open ? "true" : undefined}
        onClick={handleClick}
        title="Link this field to a global variable"
        active={highlight}
      >
        <AddLinkIcon fontSize="small" />
      </StyledIconButton>
      <Menu
        id="link-global-variable-menu"
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        MenuListProps={{
          "aria-labelledby": "link-global-variable-button",
        }}
        PaperProps={{
          variant: "elevation",
          elevation: 4,
          style: { overflowWrap: "break-word", pointerEvents: "auto", width: 280 },
        }}
        data-test="link-form"
      >
        <form onSubmit={addLink}>
          <Stack paddingY={1} paddingX={2} gap={1}>
            <Typography variant="body2">
              When linked, clicking a new object from {topic} will update the global variable&nbsp;
              <GlobalVariableName name={name} />.
            </Typography>
            <UnlinkGlobalVariables name={name} showList />
            <FilledInput
              size="small"
              autoFocus
              type="text"
              value={`$${name}`}
              onChange={(e) => setName(e.target.value.replace(/^\$/, ""))}
            />
            <Stack direction="row" gap={1} data-test="action-buttons">
              <Button
                variant="contained"
                color={name.length > 0 ? "primary" : "inherit"}
                disabled={name.length === 0}
                onClick={addLink}
              >
                Add Link
              </Button>
              <Button variant="contained" color="inherit" onClick={handleClose}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        </form>
      </Menu>
    </>
  );
}
