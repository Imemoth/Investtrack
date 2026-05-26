// In-app logger – telefonon nincs DevTools, ezért az appban tároljuk a logokat
export const appLog = {
  _entries:   [],
  _listeners: [],

  subscribe(fn) {
    this._listeners.push(fn);
    return () => { this._listeners = this._listeners.filter(l => l !== fn); };
  },

  _emit() { this._listeners.forEach(fn => fn([...this._entries])); },

  push(level, msg, detail = "") {
    const entry = { time: new Date().toLocaleTimeString("hu-HU"), level, msg, detail };
    this._entries.unshift(entry);
    if (this._entries.length > 100) this._entries.pop();
    this._emit();
    if (level === "error")      console.error(msg, detail);
    else if (level === "warn")  console.warn(msg, detail);
    else                        console.log(msg, detail);
  },

  info:  function(msg, detail) { this.push("info",  msg, detail); },
  warn:  function(msg, detail) { this.push("warn",  msg, detail); },
  error: function(msg, detail) { this.push("error", msg, detail); },
  clear() { this._entries = []; this._emit(); },
};
