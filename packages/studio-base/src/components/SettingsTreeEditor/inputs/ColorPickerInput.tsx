// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { TextField, ButtonBase, styled as muiStyled, TextFieldProps } from "@mui/material";

import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const StyledTextField = muiStyled(TextField)({
  ".MuiInputBase-formControl.MuiInputBase-root": {
    padding: 0,
  },
  ".MuiInputBase-input": {
    fontFamily: fonts.MONOSPACE,
    alignItems: "center",
  },
});

const ColorSwatch = muiStyled("div", {
  shouldForwardProp: (prop) => prop !== "color",
})<{ color: string }>(({ theme, color }) => ({
  backgroundColor: color,
  height: theme.spacing(2),
  width: theme.spacing(2),
  margin: theme.spacing(0.625),
  borderRadius: 1,
  border: `1px solid ${theme.palette.getContrastText(color)}`,
}));

type ColorPickerInputProps = {
  value: undefined | string;
  onChange: (value: undefined | string) => void;
  swatchOrientation?: "start" | "end";
} & Omit<TextFieldProps, "onChange">;

export function ColorPickerInput(props: ColorPickerInputProps): JSX.Element {
  const { onChange, swatchOrientation = "start", value } = props;

  const isValidColor = Boolean(value?.match(/^#[0-9a-fA-F]{6}$/i));
  const swatchColor = isValidColor && value != undefined ? value : "#00000044";

  return (
    <StyledTextField
      {...props}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      InputProps={{
        startAdornment: swatchOrientation === "start" && <ColorSwatch color={swatchColor} />,
        endAdornment: swatchOrientation === "end" && <ColorSwatch color={swatchColor} />,
      }}
    />
  );
}
