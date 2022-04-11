// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  Autocomplete,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  styled as muiStyled,
  MenuItem,
  Select,
  TextField,
  IconButton,
  useTheme,
} from "@mui/material";
import { useCallback } from "react";
import { DeepReadonly } from "ts-essentials";

import MessagePathInput from "@foxglove/studio-base/components/MessagePathSyntax/MessagePathInput";
import messagePathHelp from "@foxglove/studio-base/components/MessagePathSyntax/index.help.md";
import Stack from "@foxglove/studio-base/components/Stack";
import { useHelpInfo } from "@foxglove/studio-base/context/HelpInfoContext";
import { useWorkspace } from "@foxglove/studio-base/context/WorkspaceContext";

import { ColorPickerInput, ColorScalePicker, NumberInput } from "./inputs";
import { SettingsTreeField } from "./types";

const StyledToggleButtonGroup = muiStyled(ToggleButtonGroup)(({ theme }) => ({
  backgroundColor: theme.palette.action.hover,
  gap: theme.spacing(0.25),

  "& .MuiToggleButtonGroup-grouped": {
    margin: theme.spacing(0.25),
    borderRadius: theme.shape.borderRadius,
    paddingTop: 0,
    paddingBottom: 0,
    borderColor: "transparent",

    "&.Mui-selected": {
      background: theme.palette.background.paper,
      borderColor: theme.palette.action.focus,

      "&:hover": {
        borderColor: theme.palette.action.active,
      },
    },
    "&:not(:first-of-type)": {
      borderRadius: theme.shape.borderRadius,
    },
    "&:first-of-type": {
      borderRadius: theme.shape.borderRadius,
    },
  },
}));

const PsuedoInputWrapper = muiStyled(Stack)(({ theme }) => {
  const prefersDarkMode = theme.palette.mode === "dark";
  const backgroundColor = prefersDarkMode ? "rgba(255, 255, 255, 0.09)" : "rgba(0, 0, 0, 0.06)";

  return {
    padding: theme.spacing(0.5, 1),
    borderRadius: theme.shape.borderRadius,
    fontSize: "0.75em",
    backgroundColor,

    input: {
      height: "1.4375em",
    },
    "&:hover": {
      backgroundColor: prefersDarkMode ? "rgba(255, 255, 255, 0.13)" : "rgba(0, 0, 0, 0.09)",
      // Reset on touch devices, it doesn't add specificity
      "@media (hover: none)": {
        backgroundColor,
      },
    },
    "&:focus-within": {
      backgroundColor,
    },
  };
});

function FieldInput({
  field,
  update,
}: {
  field: DeepReadonly<SettingsTreeField>;
  update: (value: unknown) => void;
}): JSX.Element {
  const theme = useTheme();
  const { openHelp } = useWorkspace();
  const { setHelpInfo } = useHelpInfo();

  switch (field.input) {
    case "autocomplete":
      return (
        <Autocomplete
          freeSolo={true}
          value={field.value}
          renderInput={(params) => <TextField {...params} variant="filled" size="small" />}
          onInputChange={(_event, value) => update(value)}
          onChange={(_event, value) => update(value)}
          options={field.items}
        />
      );
    case "number":
      return (
        <NumberInput
          size="small"
          variant="filled"
          value={field.value}
          placeholder={field.placeholder}
          fullWidth
          step={field.step}
          onChange={(value) => update(value)}
        />
      );
    case "toggle":
      return (
        <StyledToggleButtonGroup
          fullWidth
          value={field.value}
          exclusive
          size="small"
          onChange={(_event, value) => update(value)}
        >
          {field.options.map((opt) => (
            <ToggleButton key={opt} value={opt}>
              {opt}
            </ToggleButton>
          ))}
        </StyledToggleButtonGroup>
      );
    case "string": {
      return (
        <TextField
          variant="filled"
          size="small"
          fullWidth
          value={field.value}
          placeholder={field.placeholder}
          onChange={(event) => update(event.target.value)}
        />
      );
    }
    case "boolean": {
      return (
        <StyledToggleButtonGroup
          fullWidth
          value={field.value}
          exclusive
          size="small"
          onChange={(_event, value) => update(value)}
        >
          <ToggleButton value={true}>On</ToggleButton>
          <ToggleButton value={false}>Off</ToggleButton>
        </StyledToggleButtonGroup>
      );
    }
    case "color": {
      return (
        <ColorPickerInput
          value={field.value?.toString()}
          size="small"
          variant="filled"
          fullWidth
          onChange={(value) => update(value)}
        />
      );
    }
    case "messagepath": {
      return (
        <PsuedoInputWrapper direction="row">
          <MessagePathInput
            path={field.value ?? ""}
            onChange={(value) => update(value)}
            validTypes={field.validTypes}
          />
          <IconButton
            size="small"
            color="secondary"
            title="Message path syntax documentation"
            onClick={() => {
              setHelpInfo({ title: "MessagePathSyntax", content: messagePathHelp });
              openHelp();
            }}
            style={{
              marginRight: theme.spacing(-1),
              marginBottom: theme.spacing(-0.5),
              marginTop: theme.spacing(-0.5),
            }}
          >
            <InfoOutlinedIcon fontSize="inherit" />
          </IconButton>
        </PsuedoInputWrapper>
      );
    }
    case "select": {
      return (
        <Select
          size="small"
          fullWidth
          variant="filled"
          value={field.value}
          onChange={(event) => update(event.target.value)}
          MenuProps={{ MenuListProps: { dense: true } }}
        >
          {field.options.map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </Select>
      );
    }
    case "gradient": {
      return <ColorScalePicker color="inherit" size="small" />;
    }
  }
}

function FieldEditorComponent({
  field,
  path,
  updateSettings,
}: {
  field: DeepReadonly<SettingsTreeField>;
  path: readonly string[];
  updateSettings: (path: readonly string[], value: unknown) => void;
}): JSX.Element {
  const update = useCallback(
    (value: unknown) => {
      updateSettings(path, value);
    },
    [path, updateSettings],
  );

  return (
    <>
      <div /> {/* Spacer for left column */}
      <Stack direction="row" alignItems="center">
        <Typography
          title={field.label}
          variant="subtitle2"
          color="text.secondary"
          noWrap
          flex="auto"
        >
          {field.label}
        </Typography>
        {field.help && (
          <IconButton size="small" color="secondary" title={field.help}>
            <HelpOutlineIcon fontSize="inherit" />
          </IconButton>
        )}
      </Stack>
      <div>
        <FieldInput field={field} update={update} />
      </div>
    </>
  );
}

export const FieldEditor = React.memo(FieldEditorComponent);
