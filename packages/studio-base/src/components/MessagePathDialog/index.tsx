// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import { Dialog, InputBase } from "@mui/material";
import { makeStyles } from "tss-react/mui";

const useStyles = makeStyles()((theme) => ({
  paper: {
    padding: theme.spacing(1, 2),
  },
  input: {
    fontSize: "2em",
  },
}));

export function MessagePathDialog(): JSX.Element {
  const { classes } = useStyles();

  return (
    <Dialog fullWidth maxWidth="lg" classes={{ paper: classes.paper }} open>
      <InputBase className={classes.input} placeholder="/some_topic/state.items[:]{}" />
    </Dialog>
  );
}
