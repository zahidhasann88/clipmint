export function isWorkerSupported(): boolean {
  return typeof Worker !== "undefined";
}

export function assertWorkerSupport(): void {
  if (!isWorkerSupported()) {
    throw new Error(
      "This browser does not support Web Workers, which the local encoder requires. Update your browser and reload.",
    );
  }
}
