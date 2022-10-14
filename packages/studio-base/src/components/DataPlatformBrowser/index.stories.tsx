// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Story } from "@storybook/react";

import { DataPlatformBrowser } from "@foxglove/studio-base/components/DataPlatformBrowser";

export default {
  title: "Data Platform Browser",
  component: DataPlatformBrowser,
};

function Default(): JSX.Element {
  return <DataPlatformBrowser />;
}

export const Light: Story = () => <Default />;
Light.parameters = { colorScheme: "light" };

export const Dark: Story = () => <Default />;
Dark.parameters = { colorScheme: "dark" };
