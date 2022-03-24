// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { SvgIcon, SvgIconProps } from "@mui/material";

export default function RosIcon(props: SvgIconProps): JSX.Element {
  return (
    <SvgIcon {...props}>
      <g fill="currentColor">
        <circle cx={4} cy={4} r={2} />
        <circle cx={12} cy={4} r={2} />
        <circle cx={20} cy={4} r={2} />

        <circle cx={4} cy={12} r={2} />
        <circle cx={12} cy={12} r={2} />
        <circle cx={20} cy={12} r={2} />

        <circle cx={4} cy={20} r={2} />
        <circle cx={12} cy={20} r={2} />
        <circle cx={20} cy={20} r={2} />
      </g>
    </SvgIcon>
  );
}
