// ============================================================
// logger.ts — לוגר קטן עם רמות וחותמות זמן
// ============================================================

import { readEnv } from './env.ts';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export class Logger {
	constructor(
		private readonly scope: string,
		private readonly minLevel: LogLevel = (readEnv('DISCOVERY_LOG_LEVEL') as LogLevel) || 'info',
	) {}

	child(scope: string): Logger {
		return new Logger(`${this.scope}:${scope}`, this.minLevel);
	}

	debug(msg: string, ...args: unknown[]): void { this.write('debug', msg, args); }
	info(msg: string, ...args: unknown[]): void { this.write('info', msg, args); }
	warn(msg: string, ...args: unknown[]): void { this.write('warn', msg, args); }
	error(msg: string, ...args: unknown[]): void { this.write('error', msg, args); }

	private write(level: LogLevel, msg: string, args: unknown[]): void {
		if (LEVELS[level] < LEVELS[this.minLevel]) return;
		const ts = new Date().toISOString().slice(11, 19);
		const line = `[${ts}] [${level.toUpperCase().padEnd(5)}] [${this.scope}] ${msg}`;
		if (level === 'error') console.error(line, ...args);
		else if (level === 'warn') console.warn(line, ...args);
		else console.log(line, ...args);
	}
}
