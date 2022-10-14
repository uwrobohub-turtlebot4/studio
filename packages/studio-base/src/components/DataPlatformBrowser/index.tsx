// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import SearchIcon from "@mui/icons-material/Search";
import { TabList, TabContext, TabPanel } from "@mui/lab";
import { Dialog, Divider, Link, Tab, TextField } from "@mui/material";
import { DataGrid, GridRowsProp, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { useState } from "react";
import { makeStyles } from "tss-react/mui";

import Stack from "@foxglove/studio-base/components/Stack";

const devices: {
  rows: GridRowsProp;
  columns: GridColDef[];
} = {
  rows: [
    { name: "Devicey", id: "dev_i2SWB8l8wBwKizGv", recordings: 2 },
    { name: "Transbot", id: "dev_i2SWB8l8wBwKizGl", recordings: 2 },
    { name: "Milesbot", id: "dev_D6i8qs9Iu0tbfCfV", recordings: 5 },
    { name: "Romanbot", id: "dev_drpLqjBZYUzus3gv", recordings: 10 },
  ],
  columns: [
    {
      field: "name",
      headerName: "Device name",
      width: 220,
      renderCell: ({ value }: GridRenderCellParams) => <Link color="primary">{value}</Link>,
    },
    { field: "id", headerName: "ID", width: 250 },
    {
      field: "recordings",
      headerName: "Recordings",
      width: 170,
    },
  ],
};

const recordings: {
  rows: GridRowsProp;
  columns: GridColDef[];
} = {
  rows: [
    {
      id: "transbot_2022-08-21-23-57-11_0",
      filename: "transbot_2022-08-21-23-57-11_0.bag",
      device: "Transbot",
    },
    {
      id: "transbot_2022-08-21-23-52-18_1",
      filename: "transbot_2022-08-21-23-52-18_1.bag",
      device: "Transbot",
    },
    {
      id: "transbot_2022-08-21-23-47-18_0",
      filename: "transbot_2022-08-21-23-47-18_0.bag",
      device: "Transbot",
    },
  ],
  columns: [
    { field: "filename", headerName: "Filename", width: 250 },
    {
      field: "device",
      headerName: "Device",
      width: 250,
      renderCell: ({ value }: GridRenderCellParams) => <Link color="primary">{value}</Link>,
    },
    { field: "start_time", headerName: "Start time", width: 250 },
    { field: "duration", headerName: "Duration", width: 250 },
    { field: "size", headerName: "Size", width: 150 },
    { field: "imported_at", headerName: "Imported", width: 250 },
  ],
};

type Tabs = "devices" | "recordings" | "timeline" | "upload";

const useStyles = makeStyles()(() => ({
  dialogPaper: {},
  tabPanel: {
    padding: 0,
    height: "60vh",
  },
}));

export function DataPlatformBrowser({ activeTab: _activeTab }: { activeTab?: Tabs }): JSX.Element {
  const { classes } = useStyles();
  const [activeTab, setActiveTab] = useState(_activeTab ?? "devices");
  const [userSignedIn] = useState(true);

  const handleChange = (_event: React.SyntheticEvent, newValue: Tabs) => {
    setActiveTab(newValue);
  };

  return (
    <Dialog open fullWidth maxWidth="lg" classes={{ paper: classes.dialogPaper }}>
      {userSignedIn ? (
        <TabContext value={activeTab}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            paddingRight={1}
          >
            <TabList onChange={handleChange}>
              <Tab value="devices" label="Devices" />
              <Tab value="recordings" label="Recordings" />
              <Tab value="timeline" label="Timeline" />
              <Tab value="uploads" label="Upload" />
            </TabList>
            {(activeTab === "devices" ||
              activeTab === "recordings" ||
              activeTab === "timeline") && (
              <TextField
                fullWidth
                size="small"
                variant="filled"
                placeholder={`Search ${activeTab === "timeline" ? "devices" : activeTab}…`}
                InputProps={{
                  startAdornment: <SearchIcon />,
                }}
                sx={{ width: 220 }}
              />
            )}
          </Stack>
          <Divider />
          <TabPanel className={classes.tabPanel} value="devices">
            <DataGrid headerHeight={0} hideFooter rows={devices.rows} columns={devices.columns} />
          </TabPanel>
          <TabPanel className={classes.tabPanel} value="recordings">
            <DataGrid hideFooter rows={recordings.rows} columns={recordings.columns} />
          </TabPanel>
          <TabPanel className={classes.tabPanel} value="timeline">
            This the view of the data on a timeline
          </TabPanel>
          <TabPanel className={classes.tabPanel} value="upload">
            <div></div>
          </TabPanel>
        </TabContext>
      ) : (
        <div>Empty state</div>
      )}
    </Dialog>
  );
}
