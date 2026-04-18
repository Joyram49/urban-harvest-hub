// lifecycle.manager.ts
import { logger } from '@/config/logger';

type ShutdownTask = {
  name: string;
  fn: () => Promise<void>;
};

export class LifecycleManager {
  private readonly tasks: ShutdownTask[] = [];
  private isShuttingDown = false;

  register(task: ShutdownTask): void {
    this.tasks.push(task);
  }

  initSignals(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];

    signals.forEach((signal) => {
      process.on(signal, (sig) => {
        void this.shutdown(sig);
      });
    });
  }

  async shutdown(signal: string): Promise<void> {
    if (this.isShuttingDown) return;
    this.isShuttingDown = true;

    logger.info(`\n${signal} received → starting graceful shutdown...`);

    const FORCE_TIMEOUT = setTimeout(() => {
      logger.error('❌ Forced shutdown due to timeout');
      process.exit(1);
    }, 10_000);

    FORCE_TIMEOUT.unref();

    for (const task of this.tasks) {
      try {
        logger.info(`🔌 Running shutdown task: ${task.name}`);
        await task.fn();
      } catch (err) {
        logger.error(`❌ Error in shutdown task "${task.name}"`, err);
      }
    }

    logger.info('✅ All shutdown tasks completed');
    process.exit(0);
  }
}
