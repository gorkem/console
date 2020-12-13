import { EventEmitter } from "events";
import * as k8s from '@kubernetes/client-node';

export class ActiveContextTracker {
  private activeContext: string | null = null;
  private readonly activeChangedEmitter: EventEmitter = new EventEmitter();

  constructor(private readonly pollIntervalMS: number) {
      this.pollActive();
  }

  public get activeChanged(): EventEmitter{
      return this.activeChangedEmitter;
  }

  public setActive(switchedTo: string): void {
      if (switchedTo !== this.activeContext) {
          this.activeContext = switchedTo;
          this.activeChangedEmitter.emit('context-changed',this.activeContext);
      }
  }

  public async activeAsync(): Promise<string> {
      const value = await this.getActiveValue();
      this.setActive(value);
      return value;
  }

  public active(): string | null {
      return this.activeContext;
  }

  private async pollActive(): Promise<never> {
      while (true) {
          const activeContext = await this.getActiveValue();
          this.setActive(activeContext);
          await sleep(this.pollIntervalMS);
      }
  }

  private getActiveValue(): string {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    return kc.currentContext;
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
  });
}
