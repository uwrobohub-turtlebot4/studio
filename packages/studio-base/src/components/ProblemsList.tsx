// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import ErrorOutlineOutlinedIcon from "@mui/icons-material/ErrorOutlineOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningIcon from "@mui/icons-material/WarningAmber";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Divider,
  Typography,
  accordionSummaryClasses,
} from "@mui/material";
import { makeStyles } from "tss-react/mui";

import {
  MessagePipelineContext,
  useMessagePipeline,
} from "@foxglove/studio-base/components/MessagePipeline";
import Stack from "@foxglove/studio-base/components/Stack";
import { fonts } from "@foxglove/studio-base/util/sharedStyleConstants";

const useStyles = makeStyles()((theme) => ({
  acccordion: {
    background: "none",
    boxShadow: "none",

    "&:hover": {
      backgroundColor: theme.palette.action.hover,
    },
    "&:not(:last-child)": {
      borderBottom: 0,
    },
    "&:before": {
      display: "none",
    },
  },
  accordionDetails: {
    padding: theme.spacing(1, 1.5, 1.5),
    fontFamily: fonts.MONOSPACE,
    fontSize: theme.typography.caption.fontSize,
  },
  acccordionSummary: {
    height: 36,
    minHeight: "auto",
    padding: theme.spacing(0, 0.5, 0, 1),

    "&.Mui-expanded": {
      minHeight: "auto",
    },
    [`& .${accordionSummaryClasses.expandIconWrapper}`]: {
      transform: "rotate(-90deg)",
    },
    [`& .${accordionSummaryClasses.expandIconWrapper}.Mui-expanded`]: {
      transform: "rotate(0deg)",
    },
  },
}));

const selectPlayerProblems = ({ playerState }: MessagePipelineContext) => playerState.problems;

export function ProblemsList(): JSX.Element {
  const { classes } = useStyles();
  const playerProblems = useMessagePipeline(selectPlayerProblems) ?? [];

  if (playerProblems.length === 0) {
    return (
      <Stack flex="auto" padding={2} fullHeight alignItems="center" justifyContent="center">
        <Typography align="center" color="text.secondary">
          No problems found
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack fullHeight flex="auto" overflow="auto">
      {playerProblems.map((problem, idx) => (
        <>
          <Accordion
            className={classes.acccordion}
            key={`${idx}.${problem.message}`}
            TransitionProps={{ unmountOnExit: true }}
          >
            <AccordionSummary
              className={classes.acccordionSummary}
              expandIcon={<ArrowDropDownIcon />}
            >
              <Stack direction="row" alignItems="center" gap={0.5}>
                {problem.severity === "warn" && <WarningIcon fontSize="small" color="warning" />}
                {problem.severity === "error" && (
                  <ErrorOutlineOutlinedIcon fontSize="small" color="error" />
                )}
                {problem.severity === "info" && <InfoOutlinedIcon fontSize="small" color="info" />}
                {problem.message}
              </Stack>
            </AccordionSummary>
            <AccordionDetails className={classes.accordionDetails}>
              {problem.tip}
              {problem.message}
            </AccordionDetails>
          </Accordion>
          <Divider />
        </>
      ))}
    </Stack>
  );
}
