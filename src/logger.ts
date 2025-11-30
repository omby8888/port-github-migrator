/**
 * Global logger
 */

export class Logger {
  static verbose = false;

  static setVerbose(verbose: boolean) {
    this.verbose = verbose;
  }

  static log(message: string) {
    console.log(message);
  }

  static info(message: string) {
    console.log(message);
  }

  static success(message: string) {
    console.log(message);
  }

  static error(message: string) {
    console.error(message);
  }

  static warn(message: string) {
    console.warn(message);
  }

  static debug(message: string) {
    if (this.verbose) console.log(`[DEBUG] ${message}`);
  }
}
