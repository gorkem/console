

import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as k8s from '@kubernetes/client-node';
// @ts-ignore
import { rootPath as root } from 'electron-root-path';

const baseEnv: NodeJS.ProcessEnv = {
  BRIDGE_USER_AUTH: 'disabled',
  BRIDGE_K8S_MODE: 'off-cluster',
  BRIDGE_K8S_AUTH: 'bearer-token',
  BRIDGE_K8S_MODE_OFF_CLUSTER_SKIP_VERIFY_TLS: 'true'
}

export class Bridge {
  private bridgeProcess: ChildProcess | undefined;

  private async getEnvironmentForCurrentContext(): Promise<NodeJS.ProcessEnv> {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    const currentContext = kc.getContextObject(kc.currentContext);
    if (!currentContext?.cluster) {
      return Promise.reject("Can not determine current kubernetes cluster from context");
    }
    const endpoint = kc.getCluster(currentContext?.cluster)?.server;
    const token = kc.getCurrentUser()?.token;
    const env = {
      ...baseEnv,
      BRIDGE_K8S_MODE_OFF_CLUSTER_ENDPOINT: endpoint,
      BRIDGE_K8S_AUTH_BEARER_TOKEN: token,
      BRIDGE_K8S_MODE_OFF_CLUSTER_THANOS: '',
      BRIDGE_K8S_MODE_OFF_CLUSTER_ALERTMANAGER: ''
    }
    const k8sApi = kc.makeApiClient(k8s.CoreV1Api);
    // BRIDGE_K8S_MODE_OFF_CLUSTER_THANOS=$(oc -n openshift-config-managed get configmap monitoring-shared-config -o jsonpath='{.data.thanosPublicURL}'
    try {
      const monEndPoint = await k8sApi.readNamespacedConfigMap('monitoring-shared-config', 'openshift-config-managed');
      if (monEndPoint && monEndPoint.body.data) {
        env.BRIDGE_K8S_MODE_OFF_CLUSTER_THANOS = monEndPoint.body.data['thanosPublicURL'];
      }
      // BRIDGE_K8S_MODE_OFF_CLUSTER_ALERTMANAGER=$(oc -n openshift-config-managed get configmap monitoring-shared-config -o jsonpath='{.data.alertmanagerPublicURL}')
      const alertEndPoint = await k8sApi.readNamespacedConfigMap('monitoring-shared-config', 'openshift-config-managed');
      if (alertEndPoint && alertEndPoint.body.data) {
        env.BRIDGE_K8S_MODE_OFF_CLUSTER_ALERTMANAGER = alertEndPoint.body.data['alertmanagerPublicURL'];
      }
    } catch (error) {
        // ignore not all clusters will have/expose these endpointsgit
        console.log(error);
    }
    return Promise.resolve(env);

  }

  public async start() {
    const currentEnv = await this.getEnvironmentForCurrentContext();


    const promise = new Promise((resolve, reject) => {

      const execPath = path.resolve(path.join(root, './bin','./bridge'));
      this.bridgeProcess = spawn(execPath, {
        env: currentEnv,
        cwd: root
      });

      this.bridgeProcess.stdout?.on('data', (data: string) => {
        console.log(`stdout: ${data}`);
        resolve(0);
      });

      this.bridgeProcess.stderr?.on('data', (data: string) => {
        console.error(`stderr: ${data}`);
        resolve(0);
      });

      this.bridgeProcess.on('error', reject)

    });
    return promise;
  }

  public async stop() {
    if (this.bridgeProcess) {
      this.bridgeProcess?.kill('SIGSTOP');
    }
  }

}
