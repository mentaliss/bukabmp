(function(global){
  "use strict";

  function normalizeKey(value){
    return String(value || "").trim().toUpperCase();
  }

  function createEpochMemo(){
    const memo = new Map();
    const epochs = new Map();
    let globalEpoch = 0;

    function currentEpoch(key){
      return Number(epochs.get(normalizeKey(key)) || 0);
    }

    function ticket(key){
      const normalized = normalizeKey(key);
      return Object.freeze({
        key: normalized,
        globalEpoch,
        keyEpoch: currentEpoch(normalized)
      });
    }

    function isCurrent(t){
      return Boolean(
        t &&
        t.globalEpoch === globalEpoch &&
        t.keyEpoch === currentEpoch(t.key)
      );
    }

    function invalidate(key){
      const normalized = normalizeKey(key);
      if(!normalized) return;
      memo.delete(normalized);
      epochs.set(normalized, currentEpoch(normalized) + 1);
    }

    function clear(){
      globalEpoch += 1;
      memo.clear();
      epochs.clear();
    }

    async function get(key, read, {force = false} = {}){
      const normalized = normalizeKey(key);
      if(!normalized) return await read();
      if(!force && memo.has(normalized)) return memo.get(normalized);

      while(true){
        if(!force && memo.has(normalized)) return memo.get(normalized);
        const t = ticket(normalized);
        const value = await read();
        if(!isCurrent(t)) continue;
        memo.set(normalized, value);
        return value;
      }
    }

    return Object.freeze({
      get,
      invalidate,
      clear,
      ticket,
      isCurrent,
      has:key=>memo.has(normalizeKey(key)),
      peek:key=>memo.get(normalizeKey(key))
    });
  }

  function createLatestRequestGuard(){
    let generation = 0;

    function invalidate(){
      generation += 1;
      return generation;
    }

    function begin(selectionKey){
      generation += 1;
      return Object.freeze({
        generation,
        selectionKey:String(selectionKey || "")
      });
    }

    function isCurrent(t, selectionKey){
      return Boolean(
        t &&
        t.generation === generation &&
        t.selectionKey === String(selectionKey || "")
      );
    }

    return Object.freeze({
      invalidate,
      begin,
      isCurrent,
      current:()=>generation
    });
  }

  global.BMP_CACHE_CONSISTENCY = Object.freeze({
    createEpochMemo,
    createLatestRequestGuard
  });
})(typeof self !== "undefined" ? self : globalThis);
