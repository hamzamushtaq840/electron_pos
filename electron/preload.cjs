const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("pos", {
  invoke: (channel, payload) => ipcRenderer.invoke(channel, payload),
  on: (channel, callback) => {
    const listener = (_, value) => callback(value);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
});
