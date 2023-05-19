// This Source Code Form is subject to the terms of the Mozilla Public
// License, v2.0. If a copy of the MPL was not distributed with this
// file, You can obtain one at http://mozilla.org/MPL/2.0/

import * as base64 from "@protobufjs/base64";
import { isEqual } from "lodash";
import { v4 as uuidv4 } from "uuid";

import { debouncePromise } from "@foxglove/den/async";
import Log from "@foxglove/log";
import { parseChannel, ParsedChannel } from "@foxglove/mcap-support";
import { MessageDefinition } from "@foxglove/message-definition";
import CommonRosTypes from "@foxglove/rosmsg-msgs-common";
import { MessageWriter as Ros1MessageWriter } from "@foxglove/rosmsg-serialization";
import { MessageWriter as Ros2MessageWriter } from "@foxglove/rosmsg2-serialization";
import { fromMillis, fromNanoSec, isGreaterThan, isLessThan, Time } from "@foxglove/rostime";
import { ParameterValue } from "@foxglove/studio";
import PlayerProblemManager from "@foxglove/studio-base/players/PlayerProblemManager";
import {
  AdvertiseOptions,
  MessageEvent,
  Player,
  PlayerCapabilities,
  PlayerMetricsCollectorInterface,
  PlayerPresence,
  PlayerProblem,
  PlayerState,
  PublishPayload,
  SubscribePayload,
  Topic,
  TopicStats,
} from "@foxglove/studio-base/players/types";
import { RosDatatypes } from "@foxglove/studio-base/types/RosDatatypes";
import rosDatatypesToMessageDefinition from "@foxglove/studio-base/util/rosDatatypesToMessageDefinition";
import {
  Channel,
  ChannelId,
  ClientChannel,
  FoxgloveClient,
  ServerCapability,
  SubscriptionId,
  Service,
  ServiceCallPayload,
  ServiceCallRequest,
  ServiceCallResponse,
  Parameter,
  StatusLevel,
} from "@foxglove/ws-protocol";

import { JsonMessageWriter } from "./JsonMessageWriter";
import { MessageWriter } from "./MessageWriter";
import WorkerSocketAdapter from "./WorkerSocketAdapter";

const log = Log.getLogger(__dirname);
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/** Suppress warnings about messages on unknown subscriptions if the susbscription was recently canceled. */
const SUBSCRIPTION_WARNING_SUPPRESSION_MS = 2000;

const ZERO_TIME = Object.freeze({ sec: 0, nsec: 0 });
const GET_ALL_PARAMS_REQUEST_ID = "get-all-params";
const GET_ALL_PARAMS_PERIOD_MS = 15000;
const ROS_ENCODINGS = ["ros1", "cdr"];
const SUPPORTED_PUBLICATION_ENCODINGS = ["json", ...ROS_ENCODINGS];
const FALLBACK_PUBLICATION_ENCODING = "json";
const SUPPORTED_SERVICE_ENCODINGS = ["json", ...ROS_ENCODINGS];

type ResolvedChannel = { channel: Channel; parsedChannel: ParsedChannel };
type Publication = ClientChannel & { messageWriter?: Ros1MessageWriter | Ros2MessageWriter };
type ResolvedService = {
  service: Service;
  parsedResponse: ParsedChannel;
  requestMessageWriter: MessageWriter;
};

export default class FoxgloveWebSocketPlayer implements Player {
  readonly #sourceId: string;

  #url: string; // WebSocket URL.
  #name: string;
  #client?: FoxgloveClient; // The client when we're connected.
  #id: string = uuidv4(); // Unique ID for this player session.
  #serverCapabilities: string[] = [];
  #playerCapabilities: (typeof PlayerCapabilities)[keyof typeof PlayerCapabilities][] = [];
  #supportedEncodings?: string[];
  #listener?: (arg0: PlayerState) => Promise<void>; // Listener for _emitState().
  #closed: boolean = false; // Whether the player has been completely closed using close().
  #topics?: Topic[]; // Topics as published by the WebSocket.
  #topicsStats = new Map<string, TopicStats>(); // Topic names to topic statistics.
  #datatypes: RosDatatypes = new Map(); // Datatypes as published by the WebSocket.
  #parsedMessages: MessageEvent[] = []; // Queue of messages that we'll send in next _emitState() call.
  #receivedBytes: number = 0;
  #metricsCollector: PlayerMetricsCollectorInterface;
  #hasReceivedMessage = false;
  #presence: PlayerPresence = PlayerPresence.INITIALIZING;
  #problems = new PlayerProblemManager();
  #numTimeSeeks = 0;
  #profile?: string;
  #urlState: PlayerState["urlState"];

  /** Earliest time seen */
  #startTime?: Time;
  /** Latest time seen */
  #endTime?: Time;
  /* The most recent published time, if available */
  #clockTime?: Time;
  /* Flag indicating if the server publishes time messages */
  #serverPublishesTime = false;

  #unresolvedSubscriptions = new Set<string>();
  #resolvedSubscriptionsByTopic = new Map<string, SubscriptionId>();
  #resolvedSubscriptionsById = new Map<SubscriptionId, ResolvedChannel>();
  #channelsByTopic = new Map<string, ResolvedChannel>();
  #channelsById = new Map<ChannelId, ResolvedChannel>();
  #unsupportedChannelIds = new Set<ChannelId>();
  #recentlyCanceledSubscriptions = new Set<SubscriptionId>();
  #parameters = new Map<string, ParameterValue>();
  #getParameterInterval?: ReturnType<typeof setInterval>;
  #openTimeout?: ReturnType<typeof setInterval>;
  #connectionAttemptTimeout?: ReturnType<typeof setInterval>;
  #unresolvedPublications: AdvertiseOptions[] = [];
  #publicationsByTopic = new Map<string, Publication>();
  #serviceCallEncoding?: string;
  #servicesByName = new Map<string, ResolvedService>();
  #serviceResponseCbs = new Map<
    ServiceCallRequest["callId"],
    (response: ServiceCallResponse) => void
  >();
  #publishedTopics?: Map<string, Set<string>>;
  #subscribedTopics?: Map<string, Set<string>>;
  #advertisedServices?: Map<string, Set<string>>;
  #nextServiceCallId = 0;

  public constructor({
    url,
    metricsCollector,
    sourceId,
  }: {
    url: string;
    metricsCollector: PlayerMetricsCollectorInterface;
    sourceId: string;
  }) {
    this.#metricsCollector = metricsCollector;
    this.#url = url;
    this.#name = url;
    this.#metricsCollector.playerConstructed();
    this.#sourceId = sourceId;
    this.#urlState = {
      sourceId: this.#sourceId,
      parameters: { url: this.#url },
    };
    this.#open();
  }

  #open = (): void => {
    if (this.#closed) {
      return;
    }
    if (this.#client != undefined) {
      throw new Error(`Attempted to open a second Foxglove WebSocket connection`);
    }
    log.info(`Opening connection to ${this.#url}`);

    // Set a timeout to abort the connection if we are still not connected by then.
    // This will abort hanging connection attempts that can for whatever reason not
    // establish a connection with the server.
    this.#connectionAttemptTimeout = setTimeout(() => {
      this.#client?.close();
    }, 10000);

    this.#client = new FoxgloveClient({
      ws:
        typeof Worker !== "undefined"
          ? new WorkerSocketAdapter(this.#url, [FoxgloveClient.SUPPORTED_SUBPROTOCOL])
          : new WebSocket(this.#url, [FoxgloveClient.SUPPORTED_SUBPROTOCOL]),
    });

    this.#client.on("open", () => {
      if (this.#closed) {
        return;
      }
      if (this.#connectionAttemptTimeout != undefined) {
        clearTimeout(this.#connectionAttemptTimeout);
      }
      this.#presence = PlayerPresence.PRESENT;
      this.#resetSessionState();
      this.#problems.clear();
      this.#channelsById.clear();
      this.#channelsByTopic.clear();
      this.#servicesByName.clear();
      this.#serviceResponseCbs.clear();
      this.#parameters.clear();
      this.#profile = undefined;
      this.#publishedTopics = undefined;
      this.#subscribedTopics = undefined;
      this.#advertisedServices = undefined;
      this.#publicationsByTopic.clear();
      this.#datatypes = new Map();

      for (const topic of this.#resolvedSubscriptionsByTopic.keys()) {
        this.#unresolvedSubscriptions.add(topic);
      }
      this.#resolvedSubscriptionsById.clear();
      this.#resolvedSubscriptionsByTopic.clear();
    });

    this.#client.on("error", (err) => {
      log.error(err);

      if (
        (err as unknown as undefined | { message?: string })?.message != undefined &&
        err.message.includes("insecure WebSocket connection")
      ) {
        this.#problems.addProblem("ws:connection-failed", {
          severity: "error",
          message: "Insecure WebSocket connection",
          tip: `Check that the WebSocket server at ${
            this.#url
          } is reachable and supports protocol version ${FoxgloveClient.SUPPORTED_SUBPROTOCOL}.`,
        });
        this.#emitState();
      }
    });

    // Note: We've observed closed being called not only when an already open connection is closed
    // but also when a new connection fails to open
    //
    // Note: We explicitly avoid clearing state like start/end times, datatypes, etc to preserve
    // this during a disconnect event. Any necessary state clearing is handled once a new connection
    // is established
    this.#client.on("close", (event) => {
      log.info("Connection closed:", event);
      this.#presence = PlayerPresence.RECONNECTING;

      if (this.#getParameterInterval != undefined) {
        clearInterval(this.#getParameterInterval);
        this.#getParameterInterval = undefined;
      }
      if (this.#connectionAttemptTimeout != undefined) {
        clearTimeout(this.#connectionAttemptTimeout);
      }

      this.#client?.close();
      this.#client = undefined;

      this.#problems.addProblem("ws:connection-failed", {
        severity: "error",
        message: "Connection failed",
        tip: `Check that the WebSocket server at ${
          this.#url
        } is reachable and supports protocol version ${FoxgloveClient.SUPPORTED_SUBPROTOCOL}.`,
      });

      this.#emitState();
      this.#openTimeout = setTimeout(this.#open, 3000);
    });

    this.#client.on("serverInfo", (event) => {
      if (!Array.isArray(event.capabilities)) {
        this.#problems.addProblem("ws:invalid-capabilities", {
          severity: "warn",
          message: `Server sent an invalid or missing capabilities field: '${event.capabilities}'`,
        });
      }

      const newSessionId = event.sessionId ?? uuidv4();
      if (this.#id !== newSessionId) {
        this.#resetSessionState();
      }

      this.#id = newSessionId;
      this.#name = `${this.#url}\n${event.name}`;
      this.#serverCapabilities = Array.isArray(event.capabilities) ? event.capabilities : [];
      this.#serverPublishesTime = this.#serverCapabilities.includes(ServerCapability.time);
      this.#supportedEncodings = event.supportedEncodings;
      this.#datatypes = new Map();

      // If the server publishes the time we clear any existing clockTime we might have and let the
      // server override
      if (this.#serverPublishesTime) {
        this.#clockTime = undefined;
      }

      const maybeRosDistro = event.metadata?.["ROS_DISTRO"];
      if (maybeRosDistro) {
        const rosDistro = maybeRosDistro;
        const isRos1 = ["melodic", "noetic"].includes(rosDistro);
        this.#profile = isRos1 ? "ros1" : "ros2";

        // Add common ROS message definitions
        const rosDataTypes = isRos1
          ? CommonRosTypes.ros1
          : ["foxy", "galactic"].includes(rosDistro)
          ? CommonRosTypes.ros2galactic
          : CommonRosTypes.ros2humble;

        for (const dataType in rosDataTypes) {
          const msgDef = (rosDataTypes as Record<string, MessageDefinition>)[dataType]!;
          this.#datatypes.set(dataType, msgDef);
          this.#datatypes.set(dataTypeToFullName(dataType), msgDef);
        }
        this.#datatypes = new Map(this.#datatypes); // Signal that datatypes changed.
      }

      if (event.capabilities.includes(ServerCapability.clientPublish)) {
        this.#playerCapabilities = this.#playerCapabilities.concat(PlayerCapabilities.advertise);
        this.#setupPublishers();
      }
      if (event.capabilities.includes(ServerCapability.services)) {
        this.#serviceCallEncoding = event.supportedEncodings?.find((e) =>
          SUPPORTED_SERVICE_ENCODINGS.includes(e),
        );

        const problemId = "callService:unsupportedEncoding";
        if (this.#serviceCallEncoding) {
          this.#playerCapabilities = this.#playerCapabilities.concat(
            PlayerCapabilities.callServices,
          );
          this.#problems.removeProblem(problemId);
        } else {
          this.#problems.addProblem(problemId, {
            severity: "warn",
            message: `Calling services is disabled as no compatible encoding could be found. \
            The server supports [${event.supportedEncodings?.join(", ")}], \
            but Studio only supports [${SUPPORTED_SERVICE_ENCODINGS.join(", ")}]`,
          });
        }
      }

      if (event.capabilities.includes(ServerCapability.parameters)) {
        this.#playerCapabilities = this.#playerCapabilities.concat(
          PlayerCapabilities.getParameters,
          PlayerCapabilities.setParameters,
        );

        // Periodically request all available parameters.
        this.#getParameterInterval = setInterval(() => {
          this.#client?.getParameters([], GET_ALL_PARAMS_REQUEST_ID);
        }, GET_ALL_PARAMS_PERIOD_MS);

        this.#client?.getParameters([], GET_ALL_PARAMS_REQUEST_ID);
      }

      if (event.capabilities.includes(ServerCapability.connectionGraph)) {
        this.#client?.subscribeConnectionGraph();
      }

      this.#emitState();
    });

    this.#client.on("status", (event) => {
      const msg = `FoxgloveWebSocket: ${event.message}`;
      if (event.level === StatusLevel.INFO) {
        log.info(msg);
      } else if (event.level === StatusLevel.WARNING) {
        log.warn(msg);
      } else {
        log.error(msg);
      }

      const problem: PlayerProblem = {
        message: event.message,
        severity: statusLevelToProblemSeverity(event.level),
      };

      if (event.message === "Send buffer limit reached") {
        problem.tip =
          "Server is dropping messages to the client. Check if you are subscribing to large or frequent topics or adjust your server send buffer limit.";
      }

      this.#problems.addProblem(event.message, problem);
      this.#emitState();
    });

    this.#client.on("advertise", (newChannels) => {
      for (const channel of newChannels) {
        let parsedChannel;
        try {
          let schemaEncoding;
          let schemaData;
          if (
            channel.encoding === "json" &&
            (channel.schemaEncoding == undefined || channel.schemaEncoding === "jsonschema")
          ) {
            schemaEncoding = "jsonschema";
            schemaData = textEncoder.encode(channel.schema);
          } else if (
            channel.encoding === "protobuf" &&
            (channel.schemaEncoding == undefined || channel.schemaEncoding === "protobuf")
          ) {
            schemaEncoding = "protobuf";
            schemaData = new Uint8Array(base64.length(channel.schema));
            if (base64.decode(channel.schema, schemaData, 0) !== schemaData.byteLength) {
              throw new Error(`Failed to decode base64 schema on channel ${channel.id}`);
            }
          } else if (
            channel.encoding === "flatbuffer" &&
            (channel.schemaEncoding == undefined || channel.schemaEncoding === "flatbuffer")
          ) {
            schemaEncoding = "flatbuffer";
            schemaData = new Uint8Array(base64.length(channel.schema));
            if (base64.decode(channel.schema, schemaData, 0) !== schemaData.byteLength) {
              throw new Error(`Failed to decode base64 schema on channel ${channel.id}`);
            }
          } else if (
            channel.encoding === "ros1" &&
            (channel.schemaEncoding == undefined || channel.schemaEncoding === "ros1msg")
          ) {
            schemaEncoding = "ros1msg";
            schemaData = textEncoder.encode(channel.schema);
          } else if (
            channel.encoding === "cdr" &&
            (channel.schemaEncoding == undefined ||
              ["ros2idl", "ros2msg"].includes(channel.schemaEncoding))
          ) {
            schemaEncoding = channel.schemaEncoding ?? "ros2msg";
            schemaData = textEncoder.encode(channel.schema);
          } else {
            const msg = channel.schemaEncoding
              ? `Unsupported combination of message / schema encoding: (${channel.encoding} / ${channel.schemaEncoding})`
              : `Unsupported message encoding ${channel.encoding}`;
            throw new Error(msg);
          }
          parsedChannel = parseChannel({
            messageEncoding: channel.encoding,
            schema: { name: channel.schemaName, encoding: schemaEncoding, data: schemaData },
          });
        } catch (error) {
          this.#unsupportedChannelIds.add(channel.id);
          this.#problems.addProblem(`schema:${channel.topic}`, {
            severity: "error",
            message: `Failed to parse channel schema on ${channel.topic}`,
            error,
          });
          this.#emitState();
          continue;
        }
        const existingChannel = this.#channelsByTopic.get(channel.topic);
        if (existingChannel && !isEqual(channel, existingChannel.channel)) {
          this.#problems.addProblem(`duplicate-topic:${channel.topic}`, {
            severity: "error",
            message: `Multiple channels advertise the same topic: ${channel.topic} (${existingChannel.channel.id} and ${channel.id})`,
          });
          this.#emitState();
          continue;
        }
        const resolvedChannel = { channel, parsedChannel };
        this.#channelsById.set(channel.id, resolvedChannel);
        this.#channelsByTopic.set(channel.topic, resolvedChannel);
      }
      this.#updateTopicsAndDatatypes();
      this.#emitState();
      this.#processUnresolvedSubscriptions();
    });

    this.#client.on("unadvertise", (removedChannels) => {
      for (const id of removedChannels) {
        const chanInfo = this.#channelsById.get(id);
        if (!chanInfo) {
          if (!this.#unsupportedChannelIds.delete(id)) {
            this.#problems.addProblem(`unadvertise:${id}`, {
              severity: "error",
              message: `Server unadvertised channel ${id} that was not advertised`,
            });
            this.#emitState();
          }
          continue;
        }
        for (const [subId, { channel }] of this.#resolvedSubscriptionsById) {
          if (channel.id === id) {
            this.#resolvedSubscriptionsById.delete(subId);
            this.#resolvedSubscriptionsByTopic.delete(channel.topic);
            this.#client?.unsubscribe(subId);
            this.#unresolvedSubscriptions.add(channel.topic);
          }
        }
        this.#channelsById.delete(id);
        this.#channelsByTopic.delete(chanInfo.channel.topic);
      }
      this.#updateTopicsAndDatatypes();
      this.#emitState();
    });

    this.#client.on("message", ({ subscriptionId, data }) => {
      if (!this.#hasReceivedMessage) {
        this.#hasReceivedMessage = true;
        this.#metricsCollector.recordTimeToFirstMsgs();
      }
      const chanInfo = this.#resolvedSubscriptionsById.get(subscriptionId);
      if (!chanInfo) {
        const wasRecentlyCanceled = this.#recentlyCanceledSubscriptions.has(subscriptionId);
        if (!wasRecentlyCanceled) {
          this.#problems.addProblem(`message-missing-subscription:${subscriptionId}`, {
            severity: "warn",
            message: `Received message on unknown subscription id: ${subscriptionId}. This might be a WebSocket server bug.`,
          });
          this.#emitState();
        }
        return;
      }

      try {
        this.#receivedBytes += data.byteLength;
        const receiveTime = this.#getCurrentTime();
        const topic = chanInfo.channel.topic;
        this.#parsedMessages.push({
          topic,
          receiveTime,
          message: chanInfo.parsedChannel.deserialize(data),
          sizeInBytes: data.byteLength,
          schemaName: chanInfo.channel.schemaName,
        });

        // Update the message count for this topic
        let stats = this.#topicsStats.get(topic);
        if (!stats) {
          stats = { numMessages: 0 };
          this.#topicsStats.set(topic, stats);
        }
        stats.numMessages++;
      } catch (error) {
        this.#problems.addProblem(`message:${chanInfo.channel.topic}`, {
          severity: "error",
          message: `Failed to parse message on ${chanInfo.channel.topic}`,
          error,
        });
      }
      this.#emitState();
    });

    this.#client.on("time", ({ timestamp }) => {
      if (!this.#serverPublishesTime) {
        return;
      }

      const time = fromNanoSec(timestamp);
      if (this.#clockTime != undefined && isLessThan(time, this.#clockTime)) {
        this.#numTimeSeeks++;
        this.#parsedMessages = [];
      }

      this.#clockTime = time;
      this.#emitState();
    });

    this.#client.on("parameterValues", ({ parameters, id }) => {
      const mappedParameters = parameters.map((param) => {
        return param.type === "byte_array"
          ? {
              ...param,
              value: Uint8Array.from(atob(param.value as string), (c) => c.charCodeAt(0)),
            }
          : param;
      });

      const newParameters = mappedParameters.filter((param) => !this.#parameters.has(param.name));

      if (id === GET_ALL_PARAMS_REQUEST_ID) {
        // Reset params
        this.#parameters = new Map(mappedParameters.map((param) => [param.name, param.value]));
      } else {
        // Update params
        mappedParameters.forEach((param) => this.#parameters.set(param.name, param.value));
      }

      this.#emitState();

      if (
        newParameters.length > 0 &&
        this.#serverCapabilities.includes(ServerCapability.parametersSubscribe)
      ) {
        // Subscribe to value updates of new parameters
        this.#client?.subscribeParameterUpdates(newParameters.map((p) => p.name));
      }
    });

    this.#client.on("advertiseServices", (services) => {
      if (!this.#serviceCallEncoding) {
        return;
      }

      let schemaEncoding: string;
      if (this.#serviceCallEncoding === "json") {
        schemaEncoding = "jsonschema";
      } else if (this.#serviceCallEncoding === "ros1") {
        schemaEncoding = "ros1msg";
      } else if (this.#serviceCallEncoding === "cdr") {
        schemaEncoding = "ros2msg";
      } else {
        throw new Error(`Unsupported encoding "${this.#serviceCallEncoding}"`);
      }

      for (const service of services) {
        const requestType = `${service.type}_Request`;
        const responseType = `${service.type}_Response`;
        const parsedRequest = parseChannel({
          messageEncoding: this.#serviceCallEncoding,
          schema: {
            name: requestType,
            encoding: schemaEncoding,
            data: textEncoder.encode(service.requestSchema),
          },
        });
        const parsedResponse = parseChannel({
          messageEncoding: this.#serviceCallEncoding,
          schema: {
            name: responseType,
            encoding: schemaEncoding,
            data: textEncoder.encode(service.responseSchema),
          },
        });
        const requestMsgDef = rosDatatypesToMessageDefinition(parsedRequest.datatypes, requestType);
        const requestMessageWriter = ROS_ENCODINGS.includes(this.#serviceCallEncoding)
          ? this.#serviceCallEncoding === "ros1"
            ? new Ros1MessageWriter(requestMsgDef)
            : new Ros2MessageWriter(requestMsgDef)
          : new JsonMessageWriter();

        // Add type definitions for service response and request
        for (const [name, types] of [...parsedRequest.datatypes, ...parsedResponse.datatypes]) {
          this.#datatypes.set(name, types);
        }
        this.#datatypes = new Map(this.#datatypes); // Signal that datatypes changed.

        const resolvedService: ResolvedService = {
          service,
          parsedResponse,
          requestMessageWriter,
        };
        this.#servicesByName.set(service.name, resolvedService);
      }
      this.#emitState();
    });

    this.#client.on("unadvertiseServices", (serviceIds) => {
      for (const serviceId of serviceIds) {
        const service: ResolvedService | undefined = Object.values(this.#servicesByName).find(
          (srv) => srv.service.id === serviceId,
        );
        if (service) {
          this.#servicesByName.delete(service.service.name);
        }
      }
    });

    this.#client.on("serviceCallResponse", (response) => {
      const responseCallback = this.#serviceResponseCbs.get(response.callId);
      if (!responseCallback) {
        this.#problems.addProblem(`callService:${response.callId}`, {
          severity: "error",
          message: `Received a response for a service for which no callback was registered`,
        });
        return;
      }
      responseCallback(response);
      this.#serviceResponseCbs.delete(response.callId);
    });

    this.#client.on("connectionGraphUpdate", (event) => {
      if (event.publishedTopics.length > 0 || event.removedTopics.length > 0) {
        const newMap: Map<string, Set<string>> = new Map(this.#publishedTopics ?? new Map());
        for (const { name, publisherIds } of event.publishedTopics) {
          newMap.set(name, new Set(publisherIds));
        }
        event.removedTopics.forEach((topic) => newMap.delete(topic));
        this.#publishedTopics = newMap;
      }
      if (event.subscribedTopics.length > 0 || event.removedTopics.length > 0) {
        const newMap: Map<string, Set<string>> = new Map(this.#subscribedTopics ?? new Map());
        for (const { name, subscriberIds } of event.subscribedTopics) {
          newMap.set(name, new Set(subscriberIds));
        }
        event.removedTopics.forEach((topic) => newMap.delete(topic));
        this.#subscribedTopics = newMap;
      }
      if (event.advertisedServices.length > 0 || event.removedServices.length > 0) {
        const newMap: Map<string, Set<string>> = new Map(this.#advertisedServices ?? new Map());
        for (const { name, providerIds } of event.advertisedServices) {
          newMap.set(name, new Set(providerIds));
        }
        event.removedServices.forEach((service) => newMap.delete(service));
        this.#advertisedServices = newMap;
      }

      this.#emitState();
    });
  };

  #updateTopicsAndDatatypes() {
    // Build a new topics array from this._channelsById
    const topics: Topic[] = Array.from(this.#channelsById.values(), (chanInfo) => ({
      name: chanInfo.channel.topic,
      schemaName: chanInfo.channel.schemaName,
    }));

    // Remove stats entries for removed topics
    const topicsSet = new Set<string>(topics.map((topic) => topic.name));
    for (const topic of this.#topicsStats.keys()) {
      if (!topicsSet.has(topic)) {
        this.#topicsStats.delete(topic);
      }
    }

    this.#topics = topics;

    // Update the _datatypes map;
    for (const { parsedChannel } of this.#channelsById.values()) {
      for (const [name, types] of parsedChannel.datatypes) {
        this.#datatypes.set(name, types);
      }
    }
    this.#datatypes = new Map(this.#datatypes); // Signal that datatypes changed.
    this.#emitState();
  }

  // Potentially performance-sensitive; await can be expensive
  // eslint-disable-next-line @typescript-eslint/promise-function-async
  #emitState = debouncePromise(() => {
    if (!this.#listener || this.#closed) {
      return Promise.resolve();
    }

    if (!this.#topics) {
      return this.#listener({
        name: this.#name,
        presence: this.#presence,
        progress: {},
        capabilities: this.#playerCapabilities,
        profile: undefined,
        playerId: this.#id,
        activeData: undefined,
        problems: this.#problems.problems(),
        urlState: this.#urlState,
      });
    }

    const currentTime = this.#getCurrentTime();
    if (!this.#startTime || isLessThan(currentTime, this.#startTime)) {
      this.#startTime = currentTime;
    }
    if (!this.#endTime || isGreaterThan(currentTime, this.#endTime)) {
      this.#endTime = currentTime;
    }

    const messages = this.#parsedMessages;
    this.#parsedMessages = [];
    return this.#listener({
      name: this.#name,
      presence: this.#presence,
      progress: {},
      capabilities: this.#playerCapabilities,
      profile: this.#profile,
      playerId: this.#id,
      problems: this.#problems.problems(),
      urlState: this.#urlState,

      activeData: {
        messages,
        totalBytesReceived: this.#receivedBytes,
        startTime: this.#startTime,
        endTime: this.#endTime,
        currentTime,
        isPlaying: true,
        speed: 1,
        lastSeekTime: this.#numTimeSeeks,
        topics: this.#topics,
        // Always copy topic stats since message counts and timestamps are being updated
        topicStats: new Map(this.#topicsStats),
        datatypes: this.#datatypes,
        parameters: new Map(this.#parameters),
        publishedTopics: this.#publishedTopics,
        subscribedTopics: this.#subscribedTopics,
        services: this.#advertisedServices,
      },
    });
  });

  public setListener(listener: (arg0: PlayerState) => Promise<void>): void {
    this.#listener = listener;
    this.#emitState();
  }

  public close(): void {
    this.#closed = true;
    this.#client?.close();
    this.#metricsCollector.close();
    this.#hasReceivedMessage = false;
    if (this.#openTimeout != undefined) {
      clearTimeout(this.#openTimeout);
      this.#openTimeout = undefined;
    }
    if (this.#getParameterInterval != undefined) {
      clearInterval(this.#getParameterInterval);
      this.#getParameterInterval = undefined;
    }
  }

  public setSubscriptions(subscriptions: SubscribePayload[]): void {
    const newTopics = new Set(subscriptions.map(({ topic }) => topic));

    if (!this.#client || this.#closed) {
      // Remember requested subscriptions so we can retry subscribing when
      // the client is available.
      this.#unresolvedSubscriptions = newTopics;
      return;
    }

    for (const topic of newTopics) {
      if (!this.#resolvedSubscriptionsByTopic.has(topic)) {
        this.#unresolvedSubscriptions.add(topic);
      }
    }

    for (const [topic, subId] of this.#resolvedSubscriptionsByTopic) {
      if (!newTopics.has(topic)) {
        this.#client.unsubscribe(subId);
        this.#resolvedSubscriptionsByTopic.delete(topic);
        this.#resolvedSubscriptionsById.delete(subId);
        this.#recentlyCanceledSubscriptions.add(subId);

        // Reset the message count for this topic
        this.#topicsStats.delete(topic);

        setTimeout(
          () => this.#recentlyCanceledSubscriptions.delete(subId),
          SUBSCRIPTION_WARNING_SUPPRESSION_MS,
        );
      }
    }
    for (const topic of this.#unresolvedSubscriptions) {
      if (!newTopics.has(topic)) {
        this.#unresolvedSubscriptions.delete(topic);
      }
    }

    this.#processUnresolvedSubscriptions();
  }

  #processUnresolvedSubscriptions() {
    if (!this.#client) {
      return;
    }

    for (const topic of this.#unresolvedSubscriptions) {
      const chanInfo = this.#channelsByTopic.get(topic);
      if (chanInfo) {
        const subId = this.#client.subscribe(chanInfo.channel.id);
        this.#unresolvedSubscriptions.delete(topic);
        this.#resolvedSubscriptionsByTopic.set(topic, subId);
        this.#resolvedSubscriptionsById.set(subId, chanInfo);
      }
    }
  }

  public setPublishers(publishers: AdvertiseOptions[]): void {
    // Since `setPublishers` is rarely called, we can get away with just unadvertising existing
    // channels und re-advertising them again
    for (const channel of this.#publicationsByTopic.values()) {
      this.#client?.unadvertise(channel.id);
    }
    this.#publicationsByTopic.clear();
    this.#unresolvedPublications = publishers;
    this.#setupPublishers();
  }

  public setParameter(key: string, value: ParameterValue): void {
    if (!this.#client) {
      throw new Error(`Attempted to set parameters without a valid Foxglove WebSocket connection`);
    }

    log.debug(`FoxgloveWebSocketPlayer.setParameter(key=${key}, value=${value})`);
    const isByteArray = value instanceof Uint8Array;
    const paramValueToSent = isByteArray ? btoa(textDecoder.decode(value)) : value;
    this.#client.setParameters(
      [
        {
          name: key,
          value: paramValueToSent as Parameter["value"],
          type: isByteArray ? "byte_array" : undefined,
        },
      ],
      uuidv4(),
    );

    // Pre-actively update our parameter map, such that a change is detected if our update failed
    this.#parameters.set(key, value);
    this.#emitState();
  }

  public publish({ topic, msg }: PublishPayload): void {
    if (!this.#client) {
      throw new Error(`Attempted to publish without a valid Foxglove WebSocket connection`);
    }

    const clientChannel = this.#publicationsByTopic.get(topic);
    if (!clientChannel) {
      throw new Error(`Tried to publish on topic '${topic}' that has not been advertised before.`);
    }

    if (clientChannel.encoding === "json") {
      // Ensure that typed arrays are encoded as arrays and not objects.
      const replacer = (_key: string, value: unknown) => {
        return ArrayBuffer.isView(value)
          ? Array.from(value as unknown as ArrayLike<unknown>)
          : value;
      };
      const message = Buffer.from(JSON.stringify(msg, replacer) ?? "");
      this.#client.sendMessage(clientChannel.id, message);
    } else if (
      ROS_ENCODINGS.includes(clientChannel.encoding) &&
      clientChannel.messageWriter != undefined
    ) {
      const message = clientChannel.messageWriter.writeMessage(msg);
      this.#client.sendMessage(clientChannel.id, message);
    }
  }

  public async callService(serviceName: string, request: unknown): Promise<unknown> {
    if (!this.#client) {
      throw new Error(
        `Attempted to call service ${serviceName} without a valid Foxglove WebSocket connection.`,
      );
    }

    if (request == undefined || typeof request !== "object") {
      throw new Error("FoxgloveWebSocketPlayer#callService request must be an object.");
    }

    const resolvedService = this.#servicesByName.get(serviceName);
    if (!resolvedService) {
      throw new Error(
        `Tried to call service '${serviceName}' that has not been advertised before.`,
      );
    }

    const { service, parsedResponse, requestMessageWriter } = resolvedService;

    const serviceCallRequest: ServiceCallPayload = {
      serviceId: service.id,
      callId: ++this.#nextServiceCallId,
      encoding: this.#serviceCallEncoding!,
      data: new DataView(new Uint8Array().buffer),
    };

    const message = requestMessageWriter.writeMessage(request);
    serviceCallRequest.data = new DataView(message.buffer);
    this.#client.sendServiceCallRequest(serviceCallRequest);

    return await new Promise<Record<string, unknown>>((resolve, reject) => {
      this.#serviceResponseCbs.set(serviceCallRequest.callId, (response: ServiceCallResponse) => {
        try {
          const data = parsedResponse.deserialize(response.data);
          resolve(data as Record<string, unknown>);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  public setGlobalVariables(): void {}

  // Return the current time
  //
  // For servers which publish a clock, we return that time. If the server disconnects we continue
  // to return the last known time. For servers which do not publish a clock, we use wall time.
  #getCurrentTime(): Time {
    // If the server does not publish the time, then we set the clock time to realtime as long as
    // the server is connected. When the server is not connected, time stops.
    if (!this.#serverPublishesTime) {
      this.#clockTime =
        this.#presence === PlayerPresence.PRESENT ? fromMillis(Date.now()) : this.#clockTime;
    }

    return this.#clockTime ?? ZERO_TIME;
  }

  #setupPublishers(): void {
    // This function will be called again once a connection is established
    if (!this.#client || this.#closed) {
      return;
    }

    if (this.#unresolvedPublications.length === 0) {
      return;
    }

    this.#problems.removeProblems((id) => id.startsWith("pub:"));

    const encoding = this.#supportedEncodings
      ? this.#supportedEncodings.find((e) => SUPPORTED_PUBLICATION_ENCODINGS.includes(e))
      : FALLBACK_PUBLICATION_ENCODING;

    for (const { topic, schemaName, options } of this.#unresolvedPublications) {
      const encodingProblemId = `pub:encoding:${topic}`;
      const msgdefProblemId = `pub:msgdef:${topic}`;

      if (!encoding) {
        this.#problems.addProblem(encodingProblemId, {
          severity: "warn",
          message: `Cannot advertise topic '${topic}': Server does not support one of the following encodings for client-side publishing: ${SUPPORTED_PUBLICATION_ENCODINGS}`,
        });
        continue;
      }

      let messageWriter: Publication["messageWriter"] = undefined;
      if (ROS_ENCODINGS.includes(encoding)) {
        // Try to retrieve the ROS message definition for this topic
        let msgdef: MessageDefinition[];
        try {
          const datatypes = options?.["datatypes"] as RosDatatypes | undefined;
          if (!datatypes || !(datatypes instanceof Map)) {
            throw new Error("The datatypes option is required for publishing");
          }
          msgdef = rosDatatypesToMessageDefinition(datatypes, schemaName);
        } catch (error) {
          log.debug(error);
          this.#problems.addProblem(msgdefProblemId, {
            severity: "warn",
            message: `Unknown message definition for "${topic}"`,
            tip: `Try subscribing to the topic "${topic}" before publishing to it`,
          });
          continue;
        }

        messageWriter =
          encoding === "ros1" ? new Ros1MessageWriter(msgdef) : new Ros2MessageWriter(msgdef);
      }

      const channelId = this.#client.advertise(topic, encoding, schemaName);
      this.#publicationsByTopic.set(topic, {
        id: channelId,
        topic,
        encoding,
        schemaName,
        messageWriter,
      });
    }

    this.#unresolvedPublications = [];
    this.#emitState();
  }

  #resetSessionState(): void {
    this.#startTime = undefined;
    this.#endTime = undefined;
    this.#clockTime = undefined;
    this.#topicsStats = new Map();
    this.#parsedMessages = [];
    this.#receivedBytes = 0;
    this.#hasReceivedMessage = false;
    this.#problems.clear();
    this.#parameters.clear();
  }
}

function dataTypeToFullName(dataType: string): string {
  const parts = dataType.split("/");
  if (parts.length === 2) {
    return `${parts[0]}/msg/${parts[1]}`;
  }
  return dataType;
}

function statusLevelToProblemSeverity(level: StatusLevel): PlayerProblem["severity"] {
  if (level === StatusLevel.INFO) {
    return "info";
  } else if (level === StatusLevel.WARNING) {
    return "warn";
  } else {
    return "error";
  }
}
