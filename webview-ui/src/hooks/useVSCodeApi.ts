// Store the VS Code API instance outside of the hook
let vscodeApiInstance: any = null;

export function useVSCodeApi() {
  if (!vscodeApiInstance) {
    try {
      vscodeApiInstance = window.acquireVsCodeApi();
    } catch (error) {
      console.error('Failed to acquire VS Code API:', error);
    }
  }
  
  return {
    postMessage: (message: any) => vscodeApiInstance?.postMessage(message),
    getState: () => vscodeApiInstance?.getState() || {},
    setState: (state: any) => vscodeApiInstance?.setState(state)
  };
}