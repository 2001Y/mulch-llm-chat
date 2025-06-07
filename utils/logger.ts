/**
 * 環境に応じてコンソールログを制御するロガーユーティリティ
 * 本番環境ではログを出力しない
 */

// 環境を判定
const isDevelopment = process.env.NODE_ENV !== "production";

// ログレベルの定義
export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

// カスタムロガークラス
class Logger {
  private shouldLog(level: LogLevel): boolean {
    // 本番環境では ERROR レベルのみ出力
    if (!isDevelopment) {
      return level === LogLevel.ERROR;
    }
    return true;
  }

  debug(...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log("[DEBUG]", ...args);
    }
  }

  log(...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(...args);
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(...args);
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(...args);
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(...args);
    }
  }

  // グループ化されたログ
  group(label?: string): void {
    if (isDevelopment) {
      console.group(label);
    }
  }

  groupEnd(): void {
    if (isDevelopment) {
      console.groupEnd();
    }
  }

  // テーブル形式のログ
  table(data: any): void {
    if (isDevelopment) {
      console.table(data);
    }
  }

  // 時間計測
  time(label: string): void {
    if (isDevelopment) {
      console.time(label);
    }
  }

  timeEnd(label: string): void {
    if (isDevelopment) {
      console.timeEnd(label);
    }
  }
}

// シングルトンインスタンスをエクスポート
export const logger = new Logger();

// グローバルなconsoleを置き換える関数（オプション）
export function replaceGlobalConsole(): void {
  if (!isDevelopment) {
    // 本番環境でのみ実行
    const noop = () => {};

    // デバッグ系のメソッドを無効化
    console.log = noop;
    console.info = noop;
    console.debug = noop;
    console.warn = noop;
    // console.error は残す（エラーは本番でも見たい）

    console.group = noop;
    console.groupEnd = noop;
    console.table = noop;
    console.time = noop;
    console.timeEnd = noop;
  }
}

// デフォルトエクスポート
export default logger;
