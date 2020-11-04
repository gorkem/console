import * as React from 'react';
import { connect } from 'react-redux';
import { Base64 } from 'js-base64';
import { useTranslation } from 'react-i18next';
import { connectToFlags, WithFlagsProps } from '@console/internal/reducers/features';
import { impersonateStateToProps } from '@console/internal/reducers/ui';
import { FLAGS } from '@console/shared';
import { WSFactory } from '@console/internal/module/ws-factory';
import { resourceURL } from '@console/internal/module/k8s';
import { PodModel } from '@console/internal/models';
import Terminal, { ImperativeTerminalType } from './Terminal';
import TerminalLoadingBox from './TerminalLoadingBox';
import useActivityTick from './useActivityTick';
import {
  getCloudShellCR,
  CLOUD_SHELL_STOPPED_BY_ANNOTATION,
  startWorkspace,
  CloudShellResource,
} from './cloud-shell-utils';
import { Button, EmptyState, EmptyStateBody } from '@patternfly/react-core';

// pod exec WS protocol is FD prefixed, base64 encoded data (sometimes json stringified)

// Channel 0 is STDIN, 1 is STDOUT, 2 is STDERR (if TTY is not requested), and 3 is a special error channel - 4 is C&C
// The server only reads from STDIN, writes to the other three.
// see also: https://github.com/kubernetes/kubernetes/pull/13885

type Props = {
  workspaceName: string;
  container: string;
  podname: string;
  namespace: string;
  shcommand?: string[];
};

type StateProps = {
  impersonate?: {
    subprotocols: string[];
  };
};

type CloudShellExecProps = Props & StateProps & WithFlagsProps;

const NO_SH =
  'starting container process caused "exec: \\"sh\\": executable file not found in $PATH"';

const CloudShellExec: React.FC<CloudShellExecProps> = ({
  workspaceName,
  container,
  podname,
  namespace,
  shcommand,
  flags,
  impersonate,
}) => {
  const [wsOpen, setWsOpen] = React.useState<boolean>(false);
  const [wsError, setWsError] = React.useState<string>();
  const [customResource, setCustomResource] = React.useState<CloudShellResource>();
  const ws = React.useRef<WSFactory>();
  const terminal = React.useRef<ImperativeTerminalType>();
  const { t } = useTranslation();

  const tick = useActivityTick(workspaceName, namespace);

  const onData = React.useCallback(
    (data: string): void => {
      tick();
      ws.current && ws.current.send(`0${Base64.encode(data)}`);
    },
    [tick],
  );

  React.useEffect(() => {
    let unmounted: boolean;
    const usedClient = flags[FLAGS.OPENSHIFT] ? 'oc' : 'kubectl';
    const cmd = shcommand || ['sh', '-i', '-c', 'TERM=xterm sh'];
    const subprotocols = (impersonate?.subprotocols || []).concat('base64.channel.k8s.io');

    const urlOpts = {
      ns: namespace,
      name: podname,
      path: 'exec',
      queryParams: {
        stdout: '1',
        stdin: '1',
        stderr: '1',
        tty: '1',
        container,
        command: cmd.map((c) => encodeURIComponent(c)).join('&command='),
      },
    };

    const path = resourceURL(PodModel, urlOpts);
    const wsOpts = {
      host: 'auto',
      reconnect: true,
      jsonParse: false,
      path,
      subprotocols,
    };

    const websocket: WSFactory = new WSFactory(`${podname}-terminal`, wsOpts);
    let previous;

    websocket
      .onmessage((msg) => {
        const currentTerminal = terminal.current;
        // error channel
        if (msg[0] === '3') {
          if (previous.includes(NO_SH)) {
            const errMsg = `This container doesn't have a /bin/sh shell. Try specifying your command in a terminal with:\r\n\r\n ${usedClient} -n ${namespace} exec ${podname} -ti <command>`;
            currentTerminal && currentTerminal.reset();
            currentTerminal && currentTerminal.onConnectionClosed(errMsg);
            websocket.destroy();
            previous = '';
            return;
          }
        }
        tick();
        const data = Base64.decode(msg.slice(1));
        currentTerminal && currentTerminal.onDataReceived(data);
        previous = data;
      })
      .onopen(() => {
        const currentTerminal = terminal.current;
        currentTerminal && currentTerminal.reset();
        previous = '';
        if (!unmounted) setWsOpen(true);
      })
      .onclose((evt) => {
        if (!evt || evt.wasClean === true) {
          return;
        }

        setWsOpen(false);

        // Check the Cloud Shell to see if it has any hints as to why the terminal connection was closed
        const cloudShellCR = getCloudShellCR(workspaceName, namespace);
        let stoppedByError;
        cloudShellCR
          .then((cr) => {
            const stopReason = cr.metadata.annotations[CLOUD_SHELL_STOPPED_BY_ANNOTATION];
            if (stopReason) {
              stoppedByError = t(
                'cloudshell~The terminal connection has closed due to {{reason}}.',
                { reason: stopReason },
              );
            }
            setCustomResource(cr);
          })
          .catch((err) => {
            stoppedByError = err;
          })
          .finally(() => {
            const error =
              evt.reason || stoppedByError || t('cloudshell~The terminal connection has closed.');
            const currentTerminal = terminal.current;
            currentTerminal && currentTerminal.onConnectionClosed(error);
            websocket.destroy();
            if (!unmounted) setWsError(error);
          })
          .catch((e) => {
            // eslint-disable-next-line no-console
            console.error(e);
          });
      }) // eslint-disable-next-line no-console
      .onerror((evt) => console.error(`WS error?! ${evt}`));

    if (ws.current !== websocket) {
      ws.current && ws.current.destroy();
      ws.current = websocket;
      const currentTerminal = terminal.current;
      currentTerminal &&
        currentTerminal.onConnectionClosed(
          t('cloudshell~connecting to {{container}}', { container }),
        );
    }

    return () => {
      unmounted = true;
      websocket.destroy();
    };
  }, [tick, container, flags, impersonate, namespace, podname, shcommand, t, workspaceName]);

  if (wsError) {
    return (
      <div className="co-cloudshell-terminal__container-error">
        <EmptyState>
          <EmptyStateBody className="cloudshell-error">{wsError}</EmptyStateBody>
          <Button
            variant="primary"
            onClick={() => {
              if (customResource) {
                startWorkspace(customResource);
                setWsError(undefined);
              }
            }}
          >
            Restart Terminal
          </Button>
        </EmptyState>
      </div>
    );
  }

  if (wsOpen) {
    return (
      <div className="co-cloudshell-terminal__container">
        <Terminal onData={onData} ref={terminal} />
      </div>
    );
  }

  return (
    <div className="co-cloudshell-terminal__container">
      <TerminalLoadingBox />
    </div>
  );
};

export default connect<StateProps>(impersonateStateToProps)(
  connectToFlags<CloudShellExecProps & WithFlagsProps>(FLAGS.OPENSHIFT)(CloudShellExec),
);
