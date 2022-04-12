// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import Stack from "@foxglove/studio-base/components/Stack";

import { NumberInput } from "./NumberInput";

export function Vect3Input({ size, variant }): JSX.Element {
  return (
    <Stack gap={0.5}>
      <NumberInput size={size} variant={variant} />
      <NumberInput size={size} variant={variant} />
      <NumberInput size={size} variant={variant} />
    </Stack>
  );
}
