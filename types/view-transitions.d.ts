interface ViewTransition {
  finished: Promise<void>;
  ready: Promise<void>;
  updateCallbackDone: Promise<void>;
}

declare global {
  interface Document {
    startViewTransition(
      updateCallback: () => void | Promise<void>
    ): ViewTransition;
  }
}
